import express from 'express';
import {
  getMicroEntries,
  getMicroEntriesWithTag,
  getMicroEntry,
} from '../../api/micro.js';
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
  const entries = await getMicroEntriesWithTag(sanitizedTag);
  res.render('micro/index.pug', {
    entries,
    options: {
      isLoggedIn: req.isAuthenticated(),
      tag: sanitizedTag, // Pug will escape it anyway, but can't hurt
    },
  });
});

export default router;
