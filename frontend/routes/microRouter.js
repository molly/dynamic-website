import express from 'express';
import { getEntry } from '../../api/feed.js';
import { authenticated } from '../../backend/routes/auth.js';

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
router.get('/entry/:slug', async (req, res) => {
  const entry = await getEntry(req.params.slug);
  res.render('micro/entry.pug', { entry });
});

export default router;
