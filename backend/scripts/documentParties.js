/**
 * Move document blocks' sender and recipient to the lists that allow several people. Documents
 * used to have one of each (from, fromRole, fromEntity; to, toRole, toEntity); they now have
 * `senders` and `recipients`, each { prefix, people: [{ name, role, entity }], more }
 * (api/helpers/documentParties.js). The site and editor read either shape, so this only tidies
 * up what's saved.
 *
 *   node backend/scripts/documentParties.js           # dry run: list what would change
 *   node backend/scripts/documentParties.js --apply   # change it
 *
 * Covers posts and their updates, and documents inside comparisons. Only those blocks' data is
 * written (straight to the database, so saving doesn't resend webmentions). Safe to run again.
 */
import {
  hasLegacyParties,
  withDocumentSides,
} from '../../api/helpers/documentParties.js';
import db from '../models/db.js';
import { MICRO_ENTRY_COLLECTION } from '../models/micro/microEntry.schema.js';

// The changes for one block, at `path`: a document to convert, or those inside a comparison
function blockChanges(block, path) {
  if (block?.type === 'comparison') {
    return ['left', 'right'].flatMap((side) =>
      blockChanges(block.data?.[side]?.block, `${path}.data.${side}.block`),
    );
  }
  if (block?.type !== 'document' || !hasLegacyParties(block.data)) {
    return [];
  }
  return [
    {
      path: `${path}.data`,
      from: block.data,
      to: withDocumentSides(block.data),
    },
  ];
}

// Each document block to convert in a list of blocks, with its path for $set
const documentChanges = (blocks, pathPrefix) =>
  (blocks || []).flatMap((block, i) =>
    blockChanges(block, `${pathPrefix}.${i}`),
  );

const describe = (data) =>
  ['senders', 'recipients']
    .map(
      (side) =>
        data[side].people
          .map((p) =>
            [p.name, p.role && `(${p.role})`, p.entity && `[${p.entity.name}]`]
              .filter(Boolean)
              .join(' '),
          )
          .join(', ') || '—',
    )
    .join(' → ');

const legacy = (data) =>
  ['from', 'to']
    .map(
      (key) =>
        [
          data[key],
          data[`${key}Role`] && `(${data[`${key}Role`]})`,
          data[`${key}Entity`] && `[${data[`${key}Entity`].name}]`,
        ]
          .filter(Boolean)
          .join(' ') || '—',
    )
    .join(' → ');

async function main() {
  const apply = process.argv.includes('--apply');
  await db.initialize();
  const collection = db.connection.collection(MICRO_ENTRY_COLLECTION);
  const types = ['document', 'comparison'];
  const entries = await collection
    .find(
      {
        $or: [
          { 'post.blocks.type': { $in: types } },
          { 'updates.body.blocks.type': { $in: types } },
        ],
      },
      { projection: { slug: 1, 'post.blocks': 1, 'updates.body.blocks': 1 } },
    )
    .toArray();

  let changed = 0;
  for (const entry of entries) {
    const changes = [
      ...documentChanges(entry.post?.blocks, 'post.blocks'),
      ...(entry.updates || []).flatMap((update, u) =>
        documentChanges(update.body?.blocks, `updates.${u}.body.blocks`),
      ),
    ];
    if (!changes.length) {
      continue;
    }
    changed += changes.length;
    for (const { path, from, to } of changes) {
      console.log(
        `${entry.slug || entry._id} ${path}\n  - ${legacy(from)}\n  + ${describe(to)}`,
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
    `\n${changed} document${changed === 1 ? '' : 's'} ${apply ? 'converted' : 'to convert (add --apply to convert them)'}.`,
  );
  await db.gracefulClose();
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
  await db.gracefulClose();
});
