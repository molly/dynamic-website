/**
 * Give every quote a style. Quotes saved before quotes had a "Pull quote" setting have no style:
 * they showed as pull quotes in a post labelled "Quoted" (one that's only quotes, and isn't live
 * or a reply), and as excerpts everywhere else. A quote with no style now shows as an excerpt
 * (api/helpers/blocks.js renderQuote), so this saves the style each older quote has been shown
 * with, and nothing about how they look changes.
 *
 *   node backend/scripts/quoteStyles.js           # dry run: list what would change
 *   node backend/scripts/quoteStyles.js --apply   # change it
 *
 * Covers posts and their updates (updates show inside the post, so they follow it). Only the
 * style is written (straight to the database, so saving doesn't resend webmentions). Safe to run
 * again: quotes that have a style are left alone.
 */
import { isQuoteOnly } from '../../api/helpers/entryMeta.js';
import db from '../models/db.js';
import { MICRO_ENTRY_COLLECTION } from '../models/micro/microEntry.schema.js';

// The paths of a document's quote blocks that have no style
function unstyledQuotes(blocks, pathPrefix) {
  return (blocks || []).flatMap((block, i) =>
    block?.type === 'quote' && !['pull', 'excerpt'].includes(block.data?.style)
      ? [`${pathPrefix}.${i}.data.style`]
      : [],
  );
}

async function main() {
  const apply = process.argv.includes('--apply');
  await db.initialize();
  const collection = db.connection.collection(MICRO_ENTRY_COLLECTION);
  const entries = await collection
    .find(
      {
        $or: [
          { 'post.blocks.type': 'quote' },
          { 'updates.body.blocks.type': 'quote' },
        ],
      },
      {
        projection: {
          slug: 1,
          live: 1,
          inReplyTo: 1,
          'post.blocks': 1,
          'updates.body.blocks': 1,
        },
      },
    )
    .toArray();

  const counts = { pull: 0, excerpt: 0 };
  for (const entry of entries) {
    const paths = [
      ...unstyledQuotes(entry.post?.blocks, 'post.blocks'),
      ...(entry.updates || []).flatMap((update, u) =>
        unstyledQuotes(update.body?.blocks, `updates.${u}.body.blocks`),
      ),
    ];
    if (!paths.length) {
      continue;
    }
    // As api/helpers/entryMeta.js labels a post "Quoted"
    const style =
      !entry.live?.status && !entry.inReplyTo?.url && isQuoteOnly(entry)
        ? 'pull'
        : 'excerpt';
    counts[style] += paths.length;
    console.log(
      `${entry.slug || entry._id}: ${paths.length} quote${paths.length === 1 ? '' : 's'} → ${style}`,
    );
    if (apply) {
      await collection.updateOne(
        { _id: entry._id },
        { $set: Object.fromEntries(paths.map((path) => [path, style])) },
      );
    }
  }
  console.log(
    `\n${counts.pull} pull quote${counts.pull === 1 ? '' : 's'} and ${counts.excerpt} excerpt${counts.excerpt === 1 ? '' : 's'} ${apply ? 'saved' : 'to save (add --apply to save them)'}.`,
  );
  await db.gracefulClose();
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
  await db.gracefulClose();
});
