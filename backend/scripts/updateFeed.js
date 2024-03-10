import db from '../models/db.js';
import { FeedEntryMicro } from '../models/feed/feedEntry.model.js';
import MicroEntry from '../models/micro/microEntry.model.js';
import { Tag } from '../models/tag.model.js';

async function migrate() {
  await db.initialize();
  const feedEntries = await FeedEntryMicro.find()
    .populate({
      path: 'tags',
      model: Tag,
      options: { sort: { value: 1 } },
    })
    .populate({
      path: 'micro',
      model: MicroEntry,
      populate: [
        { path: 'tags', model: Tag, options: { sort: { value: 1 } } },
        { path: 'relatedPost', connection: db.readingListConnection },
      ],
    });
  console.log(feedEntries.length);
  for (let entry of feedEntries) {
    const tags = entry.micro.tags;
    console.log(tags);
    entry.tags = tags;
    await entry.save();
  }
  await db.gracefulClose();
}

migrate();
