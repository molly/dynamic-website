/**
 * Clean entities' account handles of mistakes that break their links: invisible characters
 * copied along with a handle, and a Mastodon server written twice ("user@host@host"). The entity
 * model cleans handles when an entity is saved (cleanHandle in api/helpers/socialMedia.js); this
 * cleans what was saved before.
 *
 *   node backend/scripts/cleanAccountHandles.js           # dry run: list what would change
 *   node backend/scripts/cleanAccountHandles.js --apply   # change it
 *
 * An entity whose cleaned handle already belongs to another entity is reported and left alone.
 */
import { cleanHandle } from '../../api/helpers/socialMedia.js';
import { accountKey } from '../helpers/entityKeys.js';
import db from '../models/db.js';

async function main() {
  const apply = process.argv.includes('--apply');
  await db.initialize();
  const entities = db.connection.collection('entities');
  const all = await entities
    .find(
      { 'accounts.0': { $exists: true } },
      { projection: { name: 1, accounts: 1 } },
    )
    .toArray();

  let changed = 0;
  for (const entity of all) {
    const accounts = entity.accounts.map((a) => ({
      ...a,
      handle: cleanHandle(a.network, a.handle),
    }));
    const fixes = accounts
      .map((a, i) => [entity.accounts[i].handle, a])
      .filter(([before, after]) => before !== after.handle);
    if (!fixes.length) {
      continue;
    }
    const accountKeys = accounts.map((a) => accountKey(a.network, a.handle));
    const clash = await entities.findOne({
      _id: { $ne: entity._id },
      accountKeys: { $in: accountKeys },
    });
    for (const [before, after] of fixes) {
      console.log(
        `${entity.name} (${after.network}): ${JSON.stringify(before)} → ${JSON.stringify(after.handle)}`,
      );
    }
    if (clash) {
      console.log(
        `  ✗ skipped: “${clash.name}” already has one of these accounts`,
      );
      continue;
    }
    changed++;
    if (apply) {
      await entities.updateOne(
        { _id: entity._id },
        { $set: { accounts, accountKeys } },
      );
    }
  }
  console.log(
    `\n${changed} entit${changed === 1 ? 'y' : 'ies'} ${apply ? 'cleaned' : 'to clean (add --apply to clean them)'}.`,
  );
  await db.gracefulClose();
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
  await db.gracefulClose();
});
