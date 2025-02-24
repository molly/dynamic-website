import db from '../models/db.js';
import { FeedEntryReading } from '../models/feed/feedEntry.model.js';

async function copyBlockchain() {
  await db.initialize();

  await FeedEntryReading.deleteMany({ blockchain: { $exists: true } });

  await db.gracefulClose();
}

copyBlockchain();
