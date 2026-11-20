/**
 * Rename document blocks' link fields: pdfUrl → url and pdfPage → page. A document can be a web
 * page or anything else, not only a PDF (api/helpers/documentUrl.js says which links are PDFs).
 * Run it before deploying the code that reads the new names.
 *
 *   node backend/scripts/documentUrls.js           # dry run: lists every block it would change
 *   node backend/scripts/documentUrls.js --apply
 *
 * Looks for document blocks anywhere in a micro post (the post, its updates, inside comparison
 * blocks). A block that already has `url` is left as it is.
 */
import db from '../models/db.js';

// Rename the fields on every document block inside value, in place. Returns the blocks changed.
function renameIn(value, changed = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => renameIn(item, changed));
  } else if (value && typeof value === 'object') {
    const { data } = value;
    if (
      value.type === 'document' &&
      data &&
      ('pdfUrl' in data || 'pdfPage' in data) &&
      !('url' in data)
    ) {
      const { pdfUrl, pdfPage, ...rest } = data;
      value.data = {
        ...rest,
        ...(pdfUrl !== undefined ? { url: pdfUrl } : {}),
        ...(pdfPage !== undefined ? { page: pdfPage } : {}),
      };
      changed.push(value.data);
    }
    Object.values(value).forEach((child) => renameIn(child, changed));
  }
  return changed;
}

async function main() {
  const apply = process.argv.includes('--apply');
  await db.initialize();
  const collection = db.connection.collection('microEntries');
  const entries = await collection
    .find(
      {
        $or: [
          { 'post.blocks.type': 'document' },
          { 'updates.blocks.type': 'document' },
          { 'post.blocks.type': 'comparison' },
        ],
      },
      { projection: { title: 1, slug: 1, post: 1, updates: 1 } },
    )
    .toArray();

  let blocks = 0;
  let posts = 0;
  for (const entry of entries) {
    const changed = renameIn([entry.post, entry.updates]);
    if (!changed.length) {
      continue;
    }
    posts++;
    blocks += changed.length;
    console.log(`${entry.title || entry.slug} (${entry._id})`);
    for (const data of changed) {
      console.log(
        `  ${data.url || '(no link)'}${data.page ? ` · page ${data.page}` : ''}`,
      );
    }
    if (apply) {
      const set = { post: entry.post };
      if (entry.updates) {
        set.updates = entry.updates;
      }
      await collection.updateOne({ _id: entry._id }, { $set: set });
    }
  }
  console.log(
    `${apply ? 'Renamed' : 'Would rename'} ${blocks} document blocks in ${posts} posts.${apply ? '' : ' Run with --apply to save.'}`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.connection.close();
    db.redis.disconnect();
  });
