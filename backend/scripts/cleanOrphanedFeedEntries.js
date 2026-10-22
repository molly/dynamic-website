import db from '../models/db.js';
import { FeedEntryMicro } from '../models/feed/feedEntry.model.js';
import MicroEntry from '../models/micro/microEntry.model.js';

async function clean() {
  await db.initialize();

  const entries = await FeedEntryMicro.find({ deletedAt: { $exists: false } }).populate({
    path: 'micro',
    model: MicroEntry,
  });

  const orphaned = entries.filter((entry) => entry.micro === null);
  console.log(`Found ${orphaned.length} orphaned FeedEntryMicro entries.`);

  for (const entry of orphaned) {
    entry.deletedAt = new Date();
    await entry.save();
    console.log(`Soft-deleted FeedEntryMicro ${entry._id}`);
  }

  await db.gracefulClose();
}

clean();
