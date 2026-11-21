import { entryPosts } from '../backend/helpers/links.js';
import {
  OUTLET_CARD_POPULATE,
  RELATED_POPULATE,
  loadPostContext,
} from '../backend/helpers/postContext.js';
import { ENTITY_SUMMARY_FIELDS } from '../backend/helpers/entities.js';
import {
  pressAuthorHtml,
  pressWithHtml,
} from '../backend/helpers/mentionMarkup.js';
import { Book } from '../backend/models/book.model.js';
import { Entity } from '../backend/models/entity.model.js';
import {
  PRESS_ENTITY_FIELDS,
  PressEntry,
  ShortformEntry,
} from '../backend/models/entry.model.js';
import { FeedEntry } from '../backend/models/feed/feedEntry.model.js';
import MicroEntry from '../backend/models/micro/microEntry.model.js';
import { getAllTags } from '../backend/helpers/tagCache.js';
import { Tag } from '../backend/models/tag.model.js';
import { Webmention } from '../backend/models/webmention.model.js';
import { formatArticleDate } from '../data/filter/preprocess.js';
import { getPressDetails } from './helpers/press.js';
import { getReadingDetails } from './helpers/reading.js';
import { hydrateAndSortSocialLinks } from './helpers/socialMedia.js';
import { hydrateTimestamps } from './helpers/timestamps.js';
import { hydrateMicroEntry, relatedUrls } from './micro.js';

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
    entry.press = {
      ...entry.press,
      ...formatArticleDate(entry.press),
      // Who wrote it ("— Jane Doe"), and for an appearance "with …": the host, then the others
      authorHtml: pressAuthorHtml(entry.press),
      withHtml: pressWithHtml(entry.press),
    };
  }
  return entry;
};

// Entries on a page of the feed (/feed)
export const FEED_PAGE_SIZE = 10;

/**
 * The page of the feed (/feed, newest first, unfiltered) an entry is on.
 * @param {{createdAt: Date}} feedEntry
 * @returns {Promise<number>}
 */
export async function feedPageOf(feedEntry) {
  const newer = await FeedEntry.countDocuments({
    deletedAt: { $exists: false },
    createdAt: { $gt: feedEntry.createdAt },
  });
  return Math.floor(newer / FEED_PAGE_SIZE) + 1;
}

export const getFeedEntries = async ({
  query = {},
  start = 0,
  limit = 10,
  oldestFirst = false,
} = {}) => {
  const filter = { deletedAt: { $exists: false }, ...query };
  let q = FeedEntry.find(filter).sort({
    createdAt: oldestFirst ? 1 : -1,
  });

  if (start) {
    q = q.skip(start);
  }
  if (limit) {
    q = q.limit(limit);
  }

  const entriesQuery = q
    .populate({
      path: 'tags',
      model: Tag,
      options: { sort: { value: 1 } },
    })
    .populate({
      path: 'micro',
      model: MicroEntry,
      // Its posts for the social networks are only for the editor
      select: '-socialThreads',
      populate: [
        { path: 'tags', model: Tag, options: { sort: { value: 1 } } },
        RELATED_POPULATE,
        { path: 'webmentions', model: Webmention },
      ],
    })
    .populate({
      path: 'shortform',
      model: ShortformEntry,
      // Its outlet says whether it's paywalled, and so whether to offer the gift link
      populate: OUTLET_CARD_POPULATE,
    })
    .populate({ path: 'book', model: Book })
    .populate({
      path: 'press',
      model: PressEntry,
      populate: PRESS_ENTITY_FIELDS.map((path) => ({
        path,
        model: Entity,
        select: ENTITY_SUMMARY_FIELDS,
      })),
    })
    .lean();
  // The count doesn't depend on the entries, so it runs alongside them.
  const [entries, totalResults] = await Promise.all([
    entriesQuery,
    FeedEntry.countDocuments(filter),
  ]);

  if (entries.some((entry) => 'book' in entry)) {
    const bookTags = await getAllTags({ book: true });
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
  const micros = validEntries
    .filter((entry) => entry.micro)
    .map((e) => e.micro);
  const context = await loadPostContext(micros.flatMap(entryPosts), {
    urls: micros.flatMap(relatedUrls),
  });
  const hydrated = hydrateFeedEntries(validEntries, context);

  return { entries: hydrated, totalResults };
};
