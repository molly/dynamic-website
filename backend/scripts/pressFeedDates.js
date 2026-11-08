/**
 * Put press already in the feed on the day it was published. Press posted to the feed from the
 * reading list extension now goes in on its publication date (api/helpers/press.js
 * pressFeedDate); this moves the press feed entries made before that. Pieces dated without a day,
 * or dated after today, keep the time they were added.
 *
 *   node backend/scripts/pressFeedDates.js           # dry run: list what would move
 *   node backend/scripts/pressFeedDates.js --apply   # move them
 *
 * Run `npm run related` afterwards: being close in time counts towards posts being related.
 * Press feed entries only exist in the site database, so the copy from the old databases never
 * touches them. Safe to run again.
 */
import { pressFeedDate } from '../../api/helpers/press.js';
import db from '../models/db.js';
import { PressEntry } from '../models/entry.model.js';
import { FeedEntryPress } from '../models/feed/feedEntry.model.js';

async function main() {
  const apply = process.argv.includes('--apply');
  await db.initialize();
  const entries = await FeedEntryPress.find({}, 'press createdAt')
    .populate({ path: 'press', model: PressEntry, select: 'title date' })
    .lean();

  let moved = 0;
  for (const entry of entries) {
    const createdAt = entry.press ? pressFeedDate(entry.press) : null;
    if (!createdAt || createdAt.getTime() === entry.createdAt.getTime()) {
      continue;
    }
    moved += 1;
    console.log(
      `${entry.press.title}: ${entry.createdAt.toISOString().slice(0, 10)} → ${entry.press.date}`,
    );
    if (apply) {
      // Straight to the collection: the model's timestamps would keep createdAt as it was
      await FeedEntryPress.collection.updateOne(
        { _id: entry._id },
        { $set: { createdAt } },
      );
    }
  }
  console.log(
    `\n${moved} of ${entries.length} press feed entr${entries.length === 1 ? 'y' : 'ies'} ${apply ? 'moved' : 'to move (add --apply to move them)'}.`,
  );
  await db.gracefulClose();
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
  await db.gracefulClose();
});
