import express from 'express';
import { getFeedEntries } from '../../api/feed.js';

const router = express.Router();

router.get('/', async function (req, res) {
  const result = await getFeedEntries({
    limit: 5,
  });
  res.render('home.pug', {
    entries: result.entries,
    options: { isInFeed: true, isLoggedIn: req.isAuthenticated() },
  });
});

export default router;
