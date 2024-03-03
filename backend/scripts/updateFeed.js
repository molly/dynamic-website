import db from '../models/db.js';
import { BlockchainEntry } from '../models/entry.model.js';
import { FeedEntryReading } from '../models/feed/feedEntry.model.js';

async function migrate() {
  await db.initialize();
  const entries = await BlockchainEntry.find({
    entryAdded: { $gte: new Date(2024, 1, 23) },
  }).lean();
  for (let entry of entries) {
    const exists = await FeedEntryReading.findOne({ blockchain: entry._id });
    if (!exists) {
      const feedEntry = new FeedEntryReading({
        blockchain: entry._id,
        tags: entry.tags,
      });
      await feedEntry.save();
    }
  }
  await db.gracefulClose();
}

migrate();
