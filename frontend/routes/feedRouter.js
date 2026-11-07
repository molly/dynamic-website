import express from 'express';
import { getFeedEntries, hydrateFeedEntry } from '../../api/feed.js';
import { ShortformEntry } from '../../backend/models/entry.model.js';
import {
  FeedEntryCitationNeeded,
  FeedEntryReading,
} from '../../backend/models/feed/feedEntry.model.js';
import { populateTaggerFields } from '../../backend/helpers/feedEntries.js';
import { Tag } from '../../backend/models/tag.model.js';
import { authenticated } from '../../backend/routes/auth.js';
import { sanitizeTag } from '../js/helpers/sanitize.js';

const router = express.Router();
const LIMIT = 10;

router.get('/', async function (req, res) {
  const page = req.query.page ? parseInt(req.query.page, 10) : 1;
  const start = (page - 1) * LIMIT;
  const result = await getFeedEntries({
    query: {},
    start,
    limit: LIMIT,
  });

  res.render('feed/index.pug', {
    entries: result.entries,
    currentPage: page,
    pageSize: LIMIT,
    totalPages: Math.ceil(result.totalResults / LIMIT),
    totalResults: result.totalResults,
    totalUnfilteredResults: result.totalUnfilteredResults,
    options: { isInFeed: true, isLoggedIn: req.isAuthenticated() },
  });
});

// Tag feed
router.get('/tag/:tag', async (req, res) => {
  const page = req.query.page ? parseInt(req.query.page, 10) : 1;
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
    results.entries = result.entries;
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

// Metadata editor for feed entries that aren't micro posts: tags, threads, about
const TAGGER_MODELS = {
  citationNeeded: FeedEntryCitationNeeded,
  readingShortform: FeedEntryReading,
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
