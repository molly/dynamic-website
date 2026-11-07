import express from 'express';
import { getMicroEntries, getMicroEntry } from '../../api/micro.js';
import { attachFeedMeta } from '../../backend/helpers/feedMeta.js';
import { loadPostPage } from '../../backend/helpers/postPage.js';
import { Tag } from '../../backend/models/tag.model.js';
import { Webmention } from '../../backend/models/webmention.model.js';
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
  '/editor/?:slug?',
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
  await attachFeedMeta(result.entries);
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
  if (!entry) {
    res.status(400).render('micro/404.pug');
    return;
  }
  if (entry.deletedAt) {
    res.status(410).render('micro/tombstone.pug', { entry });
    return;
  }

  let image;
  for (const block of entry.post.blocks) {
    if (block.type === 'image') {
      image = block.data;
      break;
    }
  }

  await attachFeedMeta([entry]);
  const page = await loadPostPage(entry);
  res.render('micro/entry.pug', {
    entry: { ...entry, image },
    page,
    options: { isLoggedIn: req.isAuthenticated() },
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
    const result = await getMicroEntries({
      query: { tags: tag._id },
      start,
      limit: LIMIT,
    });
    results.entries = await attachFeedMeta(result.entries);
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

// Webmentions admin
router.get(
  '/webmentions',
  authenticated({ redirectTo: '/micro/login' }),
  async (_, res) => {
    const webmentions = await Webmention.find({
      approved: false,
      rejectedAt: null,
    }).sort({ createdAt: 1 });
    res.render('micro/webmentions.pug', { webmentions });
  },
);

// RSS
router.get('/feed.xml', (_, res) => {
  res.sendFile(new URL('../../rss/microFeed.xml', import.meta.url).pathname);
});

export default router;
