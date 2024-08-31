import db from '../models/db.js';
import { FeedEntryMicro } from '../models/feed/feedEntry.model.js';
import MicroEntry from '../models/micro/microEntry.model.js';

async function migrate() {
  await db.initialize();

  const entries = await FeedEntryMicro.find().populate({
    path: 'micro',
    model: MicroEntry,
  });

  for (const entry of entries) {
    entry.tags = entry.micro.tags;
    await entry.save();
  }

  await db.gracefulClose();
  return;
}

migrate();
