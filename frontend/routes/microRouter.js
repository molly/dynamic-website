import express from 'express';
import { getEntry } from '../../api/feed.js';
import { authenticated } from '../../backend/routes/auth.js';

const router = express.Router();

router.get('/login', (req, res) => {
  res.render('micro/login.pug');
});

router.get(
  '/editor',
  authenticated({ redirectTo: '/micro/login' }),
  function (req, res) {
    res.render('micro/editor.pug');
  },
);

router.get('/entry/:slug', async (req, res) => {
  const entry = await getEntry(req.params.slug);
  res.render('micro/entry.pug', { entry });
});

export default router;
