import { Book } from '../backend/models/book.model.js';
import db from '../backend/models/db.js';
import { ShortformEntry } from '../backend/models/entry.model.js';
import { FeedEntry } from '../backend/models/feed/feedEntry.model.js';
import MicroEntry from '../backend/models/micro/microEntry.model.js';
import { BookTag, Tag } from '../backend/models/tag.model.js';
import { Webmention } from '../backend/models/webmention.model.js';
import { formatArticleDate } from '../data/filter/preprocess.js';
import { getReadingDetails } from './helpers/reading.js';
import { hydrateAndSortSocialLinks } from './helpers/socialMedia.js';
import { hydrateTimestamps } from './helpers/timestamps.js';
import { hydrateMicroEntry } from './micro.js';

export const hydrateFeedEntries = (entries) => entries.map(hydrateFeedEntry);

export const hydrateFeedEntry = (entry) => {
  // Hydrate timestamps for all entries
  Object.assign(entry, { timestamps: hydrateTimestamps(entry) });

  // Do additional hydration based on entry type
  if (entry.__t === 'FeedEntryMicro' && entry.micro) {
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
    } else if ('book' in entry) {
      entry.entryType = 'readingBook';
      entry.book = {
        ...entry.book,
        ...formatArticleDate(entry.book),
      };
    }
  }
  return entry;
};

export const getFeedEntries = async ({
  query = {},
  start = 0,
  limit = 10,
} = {}) => {
  let q = FeedEntry.find({ deletedAt: { $exists: false }, ...query }).sort({
    createdAt: -1,
  });

  if (start) {
    q = q.skip(start);
  }
  if (limit) {
    q = q.limit(limit);
  }

  const entries = await q
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
        { path: 'webmentions', model: Webmention },
      ],
    })
    .populate({
      path: 'shortform',
      model: ShortformEntry,
    })
    .populate({ path: 'book', model: Book })
    .lean();

  if (entries.some((entry) => 'book' in entry)) {
    const bookTags = await BookTag.find({}).lean();
    const bookTagsMap = bookTags.reduce((acc, tag) => {
      const { _id, ...rest } = tag;
      acc[_id.toString()] = rest;
      return acc;
    }, {});
    entries.forEach((entry) => {
      if ('book' in entry) {
        entry.book.tags = entry.book.tags
          .map((tagId) => (tagId in bookTagsMap ? bookTagsMap[tagId] : tagId))
          .sort((a, b) => a.value.localeCompare(b.value));
        entry.tags = entry.tags
          .map((tagId) => (tagId in bookTagsMap ? bookTagsMap[tagId] : tagId))
          .sort((a, b) => a.value.localeCompare(b.value));
      }
    });
  }

  const hydrated = hydrateFeedEntries(entries);

  const totalResults = await FeedEntry.countDocuments(query);
  let totalUnfilteredResults = totalResults;
  if (query) {
    totalUnfilteredResults = await FeedEntry.countDocuments({});
  }

  return { entries: hydrated, totalResults, totalUnfilteredResults };
};
