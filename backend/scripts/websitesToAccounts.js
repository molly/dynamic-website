/**
 * Move entities' websites into their accounts. An entity's main website used to be `ids.website`,
 * shown under Identifiers, and its other sites website accounts, shown under Accounts; now every
 * website is an account (network "website"), so an entity can have several in one place.
 *
 *   node backend/scripts/websitesToAccounts.js           # dry run: list what would change
 *   node backend/scripts/websitesToAccounts.js --apply   # change it
 *
 * - ids.website becomes a website account, unless the entity already has that site as one, and
 *   is removed.
 * - Website accounts' keys (accountKeys, which stop two entities having the same account) are
 *   worked out again: a site now counts as the same with or without its protocol, "www." or a
 *   trailing slash (backend/helpers/entityKeys.js accountKey).
 * - When a site would then belong to two entities, neither is changed, and both are listed to
 *   sort out by hand (merge them, or remove the site from one).
 *
 * Entities only exist in the site database, so the copy from the old databases never touches
 * them. Safe to run again.
 */
import { accountKey } from '../helpers/entityKeys.js';
import db from '../models/db.js';

async function main() {
  const apply = process.argv.includes('--apply');
  await db.initialize();
  const collection = db.connection.collection('entities');
  const entities = await collection
    .find(
      {
        $or: [
          { 'ids.website': { $exists: true } },
          { 'accounts.network': 'website' },
        ],
      },
      { projection: { name: 1, ids: 1, accounts: 1, accountKeys: 1 } },
    )
    .toArray();

  // Each entity's accounts and keys as they'd be
  const changes = entities.map((entity) => {
    const accounts = [...(entity.accounts || [])];
    const website = entity.ids?.website?.trim();
    let moved = null;
    if (website) {
      const key = accountKey('website', website);
      if (!accounts.some((a) => accountKey(a.network, a.handle) === key)) {
        accounts.push({ network: 'website', handle: website });
        moved = website;
      }
    }
    return {
      entity,
      accounts,
      accountKeys: accounts.map((a) => accountKey(a.network, a.handle)),
      moved,
      hadWebsiteId: entity.ids?.website !== undefined,
    };
  });

  // Website keys held by more than one entity, once worked out again. Other entities' keys
  // (not loaded here) are checked too.
  const owners = new Map();
  for (const change of changes) {
    for (const key of change.accountKeys.filter((k) =>
      k.startsWith('website:'),
    )) {
      owners.set(key, [...(owners.get(key) || []), change.entity]);
    }
  }
  const ids = new Set(changes.map((c) => String(c.entity._id)));
  for (const [key, list] of owners) {
    const elsewhere = await collection
      .find({ accountKeys: key }, { projection: { name: 1 } })
      .toArray();
    for (const other of elsewhere) {
      if (!ids.has(String(other._id))) {
        list.push(other);
      }
    }
  }
  const clashes = [...owners].filter(([, list]) => list.length > 1);
  const clashing = new Set(
    clashes.flatMap(([, list]) => list.map((e) => String(e._id))),
  );

  let changed = 0;
  for (const change of changes) {
    const { entity } = change;
    if (clashing.has(String(entity._id))) {
      continue;
    }
    const keysChanged =
      JSON.stringify(change.accountKeys) !==
      JSON.stringify(entity.accountKeys || []);
    if (!change.hadWebsiteId && !keysChanged) {
      continue;
    }
    changed += 1;
    if (change.moved) {
      console.log(`${entity.name}: website ${change.moved} → accounts`);
    } else if (change.hadWebsiteId) {
      console.log(
        `${entity.name}: website ${entity.ids.website} already an account; removed from IDs`,
      );
    } else {
      console.log(`${entity.name}: website account keys updated`);
    }
    if (apply) {
      await collection.updateOne(
        { _id: entity._id },
        {
          $set: { accounts: change.accounts, accountKeys: change.accountKeys },
          ...(change.hadWebsiteId ? { $unset: { 'ids.website': '' } } : {}),
        },
      );
    }
  }
  for (const [key, list] of clashes) {
    console.log(
      `${key.replace(/^website:/, '')} would belong to ${list.map((e) => e.name).join(' and ')}; left as they are: merge them, or remove the site from one`,
    );
  }

  console.log(
    `\n${changed} entit${changed === 1 ? 'y' : 'ies'} ${apply ? 'changed' : 'to change (add --apply to change them)'}; ${clashes.length} site${clashes.length === 1 ? '' : 's'} on more than one entity.`,
  );
  await db.gracefulClose();
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
  await db.gracefulClose();
});
