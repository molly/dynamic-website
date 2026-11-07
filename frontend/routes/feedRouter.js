import express from 'express';
import { getFeedEntries, hydrateFeedEntry } from '../../api/feed.js';
import { FEED_FILTERS, feedFilter } from '../../api/helpers/feedFilters.js';
import {
  PressEntry,
  ShortformEntry,
} from '../../backend/models/entry.model.js';
import {
  FeedEntryCitationNeeded,
  FeedEntryPress,
  FeedEntryReading,
} from '../../backend/models/feed/feedEntry.model.js';
import { populateTaggerFields } from '../../backend/helpers/feedEntries.js';
import { attachFeedMeta } from '../../backend/helpers/feedMeta.js';
import { Thread } from '../../backend/models/thread.model.js';
import { Tag } from '../../backend/models/tag.model.js';
import { authenticated } from '../../backend/routes/auth.js';
import { sanitizeTag } from '../js/helpers/sanitize.js';

const router = express.Router();
const LIMIT = 10;

const pageNumber = (value) => Math.max(1, parseInt(value, 10) || 1);

router.get('/', async function (req, res) {
  const page = pageNumber(req.query.page);
  const { filter, query } = feedFilter(req.query.type);
  const result = await getFeedEntries({
    query,
    start: (page - 1) * LIMIT,
    limit: LIMIT,
  });

  await attachFeedMeta(result.entries);
  res.render('feed/index.pug', {
    entries: result.entries,
    currentPage: page,
    totalPages: Math.ceil(result.totalResults / LIMIT),
    filters: FEED_FILTERS,
    activeFilter: filter?.value || null,
    options: { isInFeed: true, isLoggedIn: req.isAuthenticated() },
  });
});

// Tag feed
router.get('/tag/:tag', async (req, res) => {
  const page = pageNumber(req.query.page);
  const start = (page - 1) * LIMIT;
  const sanitizedTag = sanitizeTag(req.params.tag);
  const tag = await Tag.findOne({ value: sanitizedTag });
  let hasResults = false;
  const results = {
    currentPage: page,
    pageSize: LIMIT,
    entries: [],
    totalPages: 0,
    totalResults: 0,
    totalUnfilteredResults: 0,
  };
  if (tag) {
    hasResults = true;
    const result = await getFeedEntries({
      query: { tags: tag._id },
      start,
      limit: LIMIT,
    });
    results.entries = await attachFeedMeta(result.entries);
    results.totalPages = Math.ceil(result.totalResults / LIMIT);
    results.totalResults = result.totalResults;
    results.totalUnfilteredResults = result.totalUnfilteredResults;
  }
  res.render('feed/index.pug', {
    ...results,
    options: {
      isInFeed: true,
      isLoggedIn: req.isAuthenticated(),
      tag: tag,
      tagQuery: sanitizedTag,
      hasResults,
    },
  });
});

// A thread: its entries in the order they happened.
const THREAD_LIMIT = 50;
router.get('/thread/:slug', async (req, res) => {
  const thread = await Thread.findOne({ slug: String(req.params.slug) }).lean();
  if (!thread) {
    res.status(404).render('micro/404.pug');
    return;
  }
  const page = pageNumber(req.query.page);
  const result = await getFeedEntries({
    query: { threads: thread._id },
    start: (page - 1) * THREAD_LIMIT,
    limit: THREAD_LIMIT,
    oldestFirst: true,
  });
  await attachFeedMeta(result.entries);
  res.render('feed/thread.pug', {
    thread,
    entries: result.entries,
    totalResults: result.totalResults,
    currentPage: page,
    totalPages: Math.ceil(result.totalResults / THREAD_LIMIT),
    options: { isInFeed: true, isLoggedIn: req.isAuthenticated() },
  });
});

// Metadata editor for feed entries that aren't micro posts: tags, threads, about
const TAGGER_MODELS = {
  citationNeeded: FeedEntryCitationNeeded,
  readingShortform: FeedEntryReading,
  press: FeedEntryPress,
};

router.get(
  '/tagger/:type/:id',
  authenticated({ redirectTo: '/micro/login' }),
  async (req, res) => {
    const entryType = req.params.type;
    if (entryType === 'micro') {
      res.status(400).send('Use the micro editor.');
      return;
    }
    const Model = TAGGER_MODELS[entryType];
    if (!Model) {
      res.status(400).send(`Unknown entry type "${entryType}".`);
      return;
    }
    const entry = await Model.findById(req.params.id);
    if (!entry) {
      res.sendStatus(404);
      return;
    }
    await populateTaggerFields(entry);
    if (entryType === 'readingShortform') {
      await entry.populate({ path: 'shortform', model: ShortformEntry });
    } else if (entryType === 'press') {
      await entry.populate({ path: 'press', model: PressEntry });
    }
    // Captured before hydrateFeedEntry, which reshapes the entry for display.
    const pickerData = {
      feedEntryId: entry._id,
      createdAt: entry.createdAt,
      threads: entry.threads.map((t) => t.toJSON()),
      about: entry.about.map((e) => e.toJSON()),
    };
    res.render('feed/tagger.pug', {
      entry: hydrateFeedEntry(entry),
      entryType,
      pickerData,
    });
  },
);

// RSS
router.get('/feed.xml', (_, res) => {
  res.sendFile(new URL('../../rss/feedFeed.xml', import.meta.url).pathname);
});

export default router;
