import express from 'express';
import { getMicroEntries, getMicroEntry } from '../../api/micro.js';
import { Tag } from '../../backend/models/tag.model.js';
import { authenticated } from '../../backend/routes/auth.js';
import { sanitizeTag } from '../js/helpers/sanitize.js';

const router = express.Router();

// Editing
router.get('/login', (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect('/micro/editor');
  } else {
    res.render('micro/login.pug');
  }
});

router.get(
  '/editor',
  authenticated({ redirectTo: '/micro/login' }),
  function (req, res) {
    res.render('micro/editor.pug');
  },
);

router.get(
  '/editor/:slug',
  authenticated({ redirectTo: '/micro/login' }),
  (req, res) => {
    res.render('micro/editor.pug');
  },
);

// View
// All micro posts feed
router.get('/', async (req, res) => {
  const entries = await getMicroEntries();
  res.render('micro/index.pug', {
    entries,
    options: { isLoggedIn: req.isAuthenticated() },
  });
});

// Single micro post
router.get('/entry/:slug', async (req, res) => {
  const entry = await getMicroEntry(req.params.slug);
  res.render('micro/entry.pug', {
    entry,
    options: { isLoggedIn: req.isAuthenticated() },
  });
});

// Tag feed
router.get('/tag/:tag', async (req, res) => {
  const sanitizedTag = sanitizeTag(req.params.tag);
  const tag = await Tag.findOne({ value: sanitizedTag });
  let hasResults = false;
  let entries = [];
  if (tag) {
    hasResults = true;
    entries = await getMicroEntries({ tag: tag._id });
  }
  res.render('micro/index.pug', {
    entries,
    options: {
      isLoggedIn: req.isAuthenticated(),
      tag: tag,
      tagQuery: sanitizedTag,
      hasResults,
    },
  });
});

export default router;
