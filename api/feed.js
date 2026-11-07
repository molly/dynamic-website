import { entryPosts } from '../backend/helpers/links.js';
import { loadPostContext } from '../backend/helpers/postContext.js';
import { Book } from '../backend/models/book.model.js';
import { PressEntry, ShortformEntry } from '../backend/models/entry.model.js';
import { FeedEntry } from '../backend/models/feed/feedEntry.model.js';
import MicroEntry from '../backend/models/micro/microEntry.model.js';
import { BookTag, Tag } from '../backend/models/tag.model.js';
import { Webmention } from '../backend/models/webmention.model.js';
import { formatArticleDate } from '../data/filter/preprocess.js';
import { getPressDetails } from './helpers/press.js';
import { getReadingDetails } from './helpers/reading.js';
import { hydrateAndSortSocialLinks } from './helpers/socialMedia.js';
import { hydrateTimestamps } from './helpers/timestamps.js';
import { hydrateMicroEntry } from './micro.js';

export const hydrateFeedEntries = (entries, context = {}) =>
  entries.map((entry) => hydrateFeedEntry(entry, context));

/**
 * Prepare a feed entry for display.
 * @param {Object} entry
 * @param {Object} [context] What micro posts refer to, from loadPostContext
 */
export const hydrateFeedEntry = (entry, context = {}) => {
  // Hydrate timestamps for all entries
  Object.assign(entry, { timestamps: hydrateTimestamps(entry) });

  // Do additional hydration based on entry type
  if (entry.__t === 'FeedEntryMicro' && entry.micro) {
    entry.entryType = 'micro';
    entry.micro = hydrateMicroEntry(entry.micro, context);
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
  } else if (entry.__t === 'FeedEntryPress' && entry.press) {
    entry.entryType = 'press';
    Object.assign(entry, getPressDetails(entry.press));
    entry.press = { ...entry.press, ...formatArticleDate(entry.press) };
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
        { path: 'relatedPosts.ref' },
        { path: 'webmentions', model: Webmention },
      ],
    })
    .populate({
      path: 'shortform',
      model: ShortformEntry,
    })
    .populate({ path: 'book', model: Book })
    .populate({ path: 'press', model: PressEntry })
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

  // Skip entries whose content has been deleted.
  const validEntries = entries.filter(
    (entry) =>
      (entry.__t !== 'FeedEntryMicro' || entry.micro !== null) &&
      (entry.__t !== 'FeedEntryPress' || entry.press !== null),
  );
  const context = await loadPostContext(
    validEntries
      .filter((entry) => entry.micro)
      .flatMap((entry) => entryPosts(entry.micro)),
  );
  const hydrated = hydrateFeedEntries(validEntries, context);

  const totalResults = await FeedEntry.countDocuments(query);
  let totalUnfilteredResults = totalResults;
  if (query) {
    totalUnfilteredResults = await FeedEntry.countDocuments({});
  }

  return { entries: hydrated, totalResults, totalUnfilteredResults };
};
