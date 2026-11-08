/**
 * Move entities onto the current status fields:
 *  - Remove the general status (status.value and status.date: active, defunct, merged, acquired,
 *    bankrupt), which entities no longer have.
 *  - Change bills' and cases' status from free text to one of BILL_STATUSES or CASE_STATUSES
 *    (api/helpers/entityTypes.js). The admin form now offers only those, so a bill or case left
 *    with any other status would show none there, and saving it would clear it.
 *
 *   node backend/scripts/entityStatuses.js           # dry run: list what would change
 *   node backend/scripts/entityStatuses.js --apply   # change it
 *
 * The dry run lists each general status being removed (to copy anything worth keeping into the
 * entity's note), and each bill and case status with what it becomes. A status that doesn't
 * clearly match one is left as it is and listed, to set by hand on the admin page. A bill that
 * died at the end of its Congress needs no status saying so: the page works that out from
 * `congress`. Safe to run again.
 */
import { BILL_STATUSES, CASE_STATUSES } from '../../api/helpers/entityTypes.js';
import db from '../models/db.js';

// Free-text statuses as they might have been written, most advanced stage first, so "passed House
// and Senate" is "passed Congress" rather than "passed House"
const BILL_STATUS_PATTERNS = [
  ['became law', /became law|enacted|signed|public law/],
  ['vetoed', /veto/],
  ['failed', /failed|defeated|rejected/],
  [
    'passed Congress',
    /passed congress|passed both|to (the )?president|enrolled|passed house.*senate|passed senate.*house/,
  ],
  ['passed House', /passed (the )?house/],
  ['passed Senate', /passed (the )?senate/],
  ['reported by committee', /reported/],
  ['introduced', /introduced|in committee|referred/],
];

// The same for cases, latest stage first: "dismissed, now on appeal" is "on appeal", and a
// settlement awaiting approval is "settled"
const CASE_STATUS_PATTERNS = [
  ['on appeal', /appeal/],
  ['settled', /settle|consent/],
  ['dismissed', /dismiss|dropped|withdrawn/],
  ['judgment', /judgment|verdict|ruled|decided|convicted|guilty|sentenced/],
  ['stayed', /stay/],
  ['pending', /pending|ongoing|active|open|filed/],
];

/**
 * The status free text becomes, or null if it isn't clear.
 * @param {string} text
 * @param {string[]} statuses
 * @param {[string, RegExp][]} patterns
 */
function statusFor(text, statuses, patterns) {
  if (statuses.includes(text)) {
    return text;
  }
  const lower = text.toLowerCase();
  if (/died|dead|expired/.test(lower)) {
    return null; // How far a bill got first isn't said
  }
  return patterns.find(([, pattern]) => pattern.test(lower))?.[0] ?? null;
}

/**
 * Change one type's free-text statuses to the list's, listing each.
 * @returns {Promise<{mapped: number, unclear: number}>}
 */
async function mapStatuses(
  collection,
  { type, field, statuses, patterns },
  apply,
) {
  const entities = await collection
    .find(
      { type, [field]: { $nin: [null, '', ...statuses] } },
      { projection: { name: 1, [field]: 1 } },
    )
    .toArray();
  const unclear = [];
  let mapped = 0;
  for (const entity of entities) {
    const to = statusFor(entity[field].trim(), statuses, patterns);
    if (!to) {
      unclear.push(entity);
      continue;
    }
    mapped += 1;
    console.log(
      `${entity.name}: ${type} status ${JSON.stringify(entity[field])} → ${JSON.stringify(to)}`,
    );
    if (apply) {
      await collection.updateOne(
        { _id: entity._id },
        { $set: { [field]: to } },
      );
    }
  }
  for (const entity of unclear) {
    console.log(
      `${entity.name}: ${type} status ${JSON.stringify(entity[field])} isn't clear; set it on the ${type}'s admin page`,
    );
  }
  return { mapped, unclear: unclear.length };
}

async function main() {
  const apply = process.argv.includes('--apply');
  await db.initialize();
  const collection = db.connection.collection('entities');

  const withStatus = await collection
    .find(
      { status: { $exists: true } },
      { projection: { name: 1, type: 1, status: 1 } },
    )
    .toArray();
  for (const entity of withStatus) {
    const { value, date } = entity.status || {};
    if (value || date) {
      console.log(
        `${entity.name} (${entity.type}): status ${value || '—'}${date ? ` as of ${date.toISOString().slice(0, 10)}` : ''} removed`,
      );
    }
  }
  if (apply && withStatus.length) {
    await collection.updateMany(
      { status: { $exists: true } },
      { $unset: { status: '' } },
    );
  }

  const bills = await mapStatuses(
    collection,
    {
      type: 'bill',
      field: 'billStatus',
      statuses: BILL_STATUSES,
      patterns: BILL_STATUS_PATTERNS,
    },
    apply,
  );
  const cases = await mapStatuses(
    collection,
    {
      type: 'case',
      field: 'caseStatus',
      statuses: CASE_STATUSES,
      patterns: CASE_STATUS_PATTERNS,
    },
    apply,
  );

  const mapped = bills.mapped + cases.mapped;
  const unclear = bills.unclear + cases.unclear;
  console.log(
    `\n${withStatus.length} general status${withStatus.length === 1 ? '' : 'es'} and ${mapped} bill or case status${mapped === 1 ? '' : 'es'} ${apply ? 'changed' : 'to change (add --apply to change them)'}; ${unclear} to set by hand.`,
  );
  await db.gracefulClose();
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
  await db.gracefulClose();
});
