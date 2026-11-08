/**
 * Turn image blocks' alt text from HTML into plain text. The image block used to save its alt
 * field's HTML ("Cohen &amp; Gresser", "closed.&nbsp;So"), which the site shows escaped, so
 * readers and screen readers got "&amp;" and "&nbsp;". The editor now saves alt text as plain text
 * (frontend/js/tools/ImageBlock.js); this converts what was saved before. Gallery alt text was
 * always plain text and isn't touched.
 *
 *   node backend/scripts/plainTextAlts.js           # dry run: list what would change
 *   node backend/scripts/plainTextAlts.js --apply   # change it
 *
 * Covers posts and their updates. Only the alt text is written (straight to the database, so
 * saving doesn't resend webmentions); nothing else about a post changes. Safe to run again: plain
 * text comes out as it went in.
 */
import { htmlToText } from '../../api/helpers/html.js';
import db from '../models/db.js';
import { MICRO_ENTRY_COLLECTION } from '../models/micro/microEntry.schema.js';

// Each image block in a document's blocks whose alt text changes, with its path for $set
function altChanges(blocks, pathPrefix) {
  return (blocks || []).flatMap((block, i) => {
    if (block?.type !== 'image' || typeof block.data?.alt !== 'string') {
      return [];
    }
    const text = htmlToText(block.data.alt);
    return text === block.data.alt
      ? []
      : [
          {
            path: `${pathPrefix}.${i}.data.alt`,
            from: block.data.alt,
            to: text,
          },
        ];
  });
}

async function main() {
  const apply = process.argv.includes('--apply');
  await db.initialize();
  const collection = db.connection.collection(MICRO_ENTRY_COLLECTION);
  const entries = await collection
    .find(
      {
        $or: [
          { 'post.blocks.type': 'image' },
          { 'updates.body.blocks.type': 'image' },
        ],
      },
      { projection: { slug: 1, 'post.blocks': 1, 'updates.body.blocks': 1 } },
    )
    .toArray();

  let changed = 0;
  for (const entry of entries) {
    const changes = [
      ...altChanges(entry.post?.blocks, 'post.blocks'),
      ...(entry.updates || []).flatMap((update, u) =>
        altChanges(update.body?.blocks, `updates.${u}.body.blocks`),
      ),
    ];
    if (!changes.length) {
      continue;
    }
    changed += changes.length;
    for (const { path, from, to } of changes) {
      console.log(
        `${entry.slug || entry._id} ${path}\n  - ${JSON.stringify(from.slice(0, 120))}\n  + ${JSON.stringify(to.slice(0, 120))}`,
      );
    }
    if (apply) {
      await collection.updateOne(
        { _id: entry._id },
        { $set: Object.fromEntries(changes.map(({ path, to }) => [path, to])) },
      );
    }
  }
  console.log(
    `\n${changed} alt text${changed === 1 ? '' : 's'} ${apply ? 'converted' : 'to convert (add --apply to convert them)'}, in ${entries.length} posts with images.`,
  );
  await db.gracefulClose();
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
  await db.gracefulClose();
});
