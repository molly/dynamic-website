import express from 'express';
import { getFeedEntries } from '../../api/feed.js';
import {
  BlockchainEntry,
  ShortformEntry,
} from '../../backend/models/entry.model.js';
import {
  FeedEntryCitationNeeded,
  FeedEntryReading,
} from '../../backend/models/feed/feedEntry.model.js';
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

  console.log(result.entries);
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
      isLoggedIn: req.isAuthenticated(),
      tag: tag,
      tagQuery: sanitizedTag,
      hasResults,
    },
  });
});

// Tag editor
router.get(
  '/tagger/:type/:id',
  authenticated({ redirectTo: '/micro/login' }),
  async (req, res) => {
    const entryType = req.params.type;
    const entryId = req.params.id;
    let entry;
    if (entryType === 'micro') {
      res.status(400).send('Use the micro editor.');
    } else if (entryType === 'citationNeeded') {
      entry = await FeedEntryCitationNeeded.findById(entryId).populate({
        path: 'tags',
        model: Tag,
      });
      res.render('feed/tagger.pug', { entry, entryType: 'citationNeeded' });
    } else if (
      entryType === 'readingShortform' ||
      entryType === 'readingBlockchain'
    ) {
      entry = await FeedEntryReading.findById(entryId)
        .populate({
          path: 'tags',
          model: Tag,
          options: { sort: { value: 1 } },
        })
        .populate({
          path: 'shortform',
          model: ShortformEntry,
        })
        .populate({ path: 'blockchain', model: BlockchainEntry });
      res.render('feed/tagger.pug', { entry, entryType });
    } else {
      res.statusCode(400);
    }
  },
);

// RSS
router.get('/feed.xml', (_, res) => {
  res.sendFile(new URL('../../rss/feedFeed.xml', import.meta.url).pathname);
});

export default router;
