import {
  BlockchainEntry,
  ShortformEntry,
} from '../backend/models/entry.model.js';
import { FeedEntry } from '../backend/models/feed/feedEntry.model.js';
import MicroEntry from '../backend/models/micro/microEntry.model.js';
import { Tag } from '../backend/models/tag.model.js';
import { formatArticleDate } from '../data/filter/preprocess.js';
import { getReadingDetails } from './helpers/reading.js';
import { hydrateAndSortSocialLinks } from './helpers/socialMedia.js';
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
      if ('socialLinks' in entry && entry.socialLinks.length > 0) {
        entry.socialLinks = hydrateAndSortSocialLinks(entry.socialLinks);
      }
    } else if (entry.__t === 'FeedEntryReading') {
      Object.assign(entry, getReadingDetails(entry));
      if ('shortform' in entry) {
        entry.entryType = 'readingShortform';
        entry.shortform = {
          ...entry.shortform,
          ...formatArticleDate(entry.shortform),
        };
      } else if ('blockchain' in entry) {
        entry.entryType = 'readingBlockchain';
        entry.blockchain = {
          ...entry.blockchain,
          ...formatArticleDate(entry.blockchain),
        };
      }
    }
    return entry;
  });

export const getFeedEntries = async () => {
  const entries = await FeedEntry.find()
    .sort({ createdAt: -1 })
    .limit(20)
    .populate({
      path: 'micro',
      model: MicroEntry,
      populate: { path: 'tags', model: Tag },
    })
    .populate({
      path: 'shortform',
      model: ShortformEntry,
    })
    .populate({ path: 'blockchain', model: BlockchainEntry })
    .lean();
  return hydrateFeedEntries(entries);
};
