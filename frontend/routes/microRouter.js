import express from 'express';
import { getMicroEntries, getMicroEntry } from '../../api/micro.js';
import { Tag } from '../../backend/models/tag.model.js';
import { authenticated } from '../../backend/routes/auth.js';
import { sanitizeTag } from '../js/helpers/sanitize.js';

const router = express.Router();
const LIMIT = 10;

// Editing
router.get('/login', (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect('/micro/editor');
  } else {
    res.render('micro/login.pug');
  }
});

router.get(
  '/editor/:slug?',
  authenticated({ redirectTo: '/micro/login' }),
  (req, res) => {
    res.render('micro/editor.pug');
  },
);

// View
// All micro posts feed
router.get('/', async (req, res) => {
  const page = req.query.page ? parseInt(req.query.page, 10) : 1;
  const start = (page - 1) * LIMIT;
  const result = await getMicroEntries({ query: {}, start, limit: LIMIT });
  res.render('micro/index.pug', {
    entries: result.entries,
    currentPage: page,
    pageSize: LIMIT,
    totalPages: Math.ceil(result.totalResults / LIMIT),
    totalResults: result.totalResults,
    totalUnfilteredResults: result.totalUnfilteredResults,
    options: { isLoggedIn: req.isAuthenticated() },
  });
});

// Single micro post
router.get('/entry/:slug', async (req, res) => {
  const entry = await getMicroEntry(req.params.slug);
  if (entry.deletedAt) {
    res.status(410).render('micro/tombstone.pug', { entry });
    return;
  } else {
    res.render('micro/entry.pug', {
      entry,
      options: { isLoggedIn: req.isAuthenticated() },
    });
  }
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
    const result = await getMicroEntries({
      query: { tag: tag._id },
      start,
      limit: LIMIT,
    });
    results.entries = result.entries;
    results.totalPages = Math.ceil(result.totalResults / LIMIT);
    results.totalResults = result.totalResults;
    results.totalUnfilteredResults = result.totalUnfilteredResults;
  }
  res.render('micro/index.pug', {
    ...results,
    options: {
      isLoggedIn: req.isAuthenticated(),
      tag: tag,
      tagQuery: sanitizedTag,
      hasResults,
    },
  });
});

// RSS
router.get('/feed.xml', (_, res) => {
  res.sendFile(new URL('../../rss/microFeed.xml', import.meta.url).pathname);
});

export default router;
