import db from '../models/db.js';
import {
  BlockchainEntry,
  PressEntry,
  ShortformEntry,
} from '../models/entry.model.js';
import { FeedEntryCitationNeeded } from '../models/feed/feedEntry.model.js';
import MicroEntry from '../models/micro/microEntry.model.js';
import { Tag } from '../models/tag.model.js';

async function migrate() {
  await db.initialize();

  const tags = await Tag.find();
  for (const tag of tags) {
    tag.frequency = {
      shortform: 0,
      blockchain: 0,
      micro: 0,
      citationNeeded: 0,
      press: 0,
      total: 0,
    };
    await tag.save();
  }

  const models = [
    { model: MicroEntry, collection: 'micro' },
    { model: BlockchainEntry, collection: 'blockchain' },
    { model: ShortformEntry, collection: 'shortform' },
    { model: PressEntry, collection: 'press' },
    { model: FeedEntryCitationNeeded, collection: 'citationNeeded' },
  ];

  for (const model of models) {
    let entries = await model.model.find().populate({
      path: 'tags',
      model: Tag,
      options: { sort: { value: 1 } },
    });

    for (const entry of entries) {
      for (const tag of entry.tags) {
        tag.frequency[model.collection] += 1;
        tag.frequency.total += 1;
        await tag.save();
      }
    }
  }

  await db.gracefulClose();
  return;
}

migrate();
