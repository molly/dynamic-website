/**
 * Move entities' Wikipedia articles out of their accounts. The article about someone used to be
 * kept as a "wikipedia" account (its title as the handle); it's now `ids.wikipedia`, the article's
 * link (api/helpers/wikipedia.js), and "wikipedia" is no longer an account network.
 *
 *   node backend/scripts/wikipediaArticles.js           # dry run: list what would change
 *   node backend/scripts/wikipediaArticles.js --apply   # change it
 *
 * Run before using the editor on an entity that still has one: the entity model no longer
 * accepts a wikipedia account. An entity that already has a different ids.wikipedia is reported
 * and left alone. Safe to run again.
 */
import { wikipediaArticleUrl } from '../../api/helpers/wikipedia.js';
import db from '../models/db.js';

async function main() {
  const apply = process.argv.includes('--apply');
  await db.initialize();
  const entities = db.connection.collection('entities');
  const found = await entities
    .find(
      { 'accounts.network': 'wikipedia' },
      { projection: { name: 1, accounts: 1, ids: 1 } },
    )
    .toArray();

  let moved = 0;
  const skipped = [];
  for (const entity of found) {
    const articles = [
      ...new Set(
        entity.accounts
          .filter((a) => a.network === 'wikipedia')
          .map((a) => wikipediaArticleUrl(a.handle)),
      ),
    ];
    const existing = entity.ids?.wikipedia;
    if (
      articles.length !== 1 ||
      !articles[0] ||
      (existing && existing !== articles[0])
    ) {
      skipped.push(
        `${entity.name}: ${articles.join(', ') || '(unreadable)'}${existing ? `; already has ${existing}` : ''}`,
      );
      continue;
    }
    console.log(`${entity.name}\n  → ${articles[0]}`);
    moved++;
    if (apply) {
      await entities.updateOne(
        { _id: entity._id },
        {
          $set: { 'ids.wikipedia': articles[0] },
          $pull: {
            accounts: { network: 'wikipedia' },
            accountKeys: { $regex: /^wikipedia:/ },
          },
        },
      );
    }
  }
  for (const line of skipped) {
    console.log(`Skipped (fix by hand): ${line}`);
  }
  console.log(
    `\n${moved} entit${moved === 1 ? 'y' : 'ies'} ${apply ? 'moved' : 'to move (add --apply to move them)'}${skipped.length ? `, ${skipped.length} skipped` : ''}.`,
  );
  await db.gracefulClose();
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
  await db.gracefulClose();
});
