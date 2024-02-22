import { FeedEntry } from '../backend/models/feed/feedEntry.model.js';
import MicroEntry from '../backend/models/micro/microEntry.model.js';
import { hydrateEntry } from './micro.js';

const hydrateFeedEntries = (entries) =>
  entries.map((entry) => {
    entry.micro = hydrateEntry(entry.micro);
    return entry;
  });

export const getFeedEntries = async () => {
  const entries = await FeedEntry.find()
    .sort({ createdAt: -1 })
    .limit(20)
    .populate({ path: 'micro', model: MicroEntry, populate: { path: 'tags' } })
    .lean();
  return hydrateFeedEntries(entries);
};
