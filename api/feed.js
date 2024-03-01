import { FeedEntry } from '../backend/models/feed/feedEntry.model.js';
import MicroEntry from '../backend/models/micro/microEntry.model.js';
import { hydrateTimestamps } from './helpers/timestamps.js';
import { hydrateMicroEntry } from './micro.js';

const hydrateFeedEntries = (entries) =>
  entries.map((entry) => {
    // Hydrate timestamps for all entries
    Object.assign(entry, hydrateTimestamps(entry));

    // Do additional hydration based on entry type
    if (entry.__t === 'FeedEntryMicro') {
      entry.entryType = 'micro';
      entry.micro = hydrateMicroEntry(entry.micro);
    } else if (entry.__t === 'FeedEntryCitationNeeded') {
      entry.entryType = 'citationNeeded';
    }
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
