import express from 'express';
import { getMicroEntries, getMicroEntry } from '../../api/micro.js';
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

  // Sort webmentions
  let webmentions = null;
  if (entry.webmentions && entry.webmentions.length > 0) {
    webmentions = {
      withContent: [],
      likes: [],
      reposts: [],
      bookmarks: [],
    };
    entry.webmentions.forEach((mention) => {
      if (!mention.approved) {
        return;
      }
      if (mention.body.content || mention.body.summary) {
        webmentions.withContent.push(mention);
      } else if (mention.body.type === 'like') {
        webmentions.likes.push(mention);
      } else if (mention.body.type === 'repost') {
        webmentions.reposts.push(mention);
      } else if (mention.body.type === 'bookmark') {
        webmentions.bookmarks.push(mention);
      }
    });
    for (const key in webmentions) {
      webmentions[key].sort((a, b) => {
        if (a.published > b.published) {
          return -1;
        }
        if (a.published < b.published) {
          return 1;
        }
        return 0;
      });
    }
  }

  let image;
  for (const block of entry.post.blocks) {
    if (block.type === 'image') {
      image = block.data;
      break;
    }
  }

  res.render('micro/entry.pug', {
    entry: { ...entry, webmentions, image },
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

// Webmentions admin
router.get(
  '/webmentions',
  authenticated({ redirectTo: '/micro/login' }),
  async (_, res) => {
    const webmention = await Webmention.findOne({ approved: false });
    res.render('micro/webmentions.pug', { webmention });
  },
);

// RSS
router.get('/feed.xml', (_, res) => {
  res.sendFile(new URL('../../rss/microFeed.xml', import.meta.url).pathname);
});

export default router;
