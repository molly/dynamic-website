import express from 'express';
import { getFeedEntries } from '../../api/feed.js';

const router = express.Router();

router.get('/', async function (req, res) {
  const entries = await getFeedEntries();
  res.render('feed/index.pug', {
    entries,
    options: { isInFeed: true, isLoggedIn: req.isAuthenticated() },
  });
});

export default router;