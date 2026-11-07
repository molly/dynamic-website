import express from 'express';
import { getFeedEntries } from '../../api/feed.js';
import { FEED_FILTERS } from '../../api/helpers/feedFilters.js';
import { attachFeedMeta } from '../../backend/helpers/feedMeta.js';

const router = express.Router();
const LIMIT = 10; // The same as the feed's first page, so "older" goes to its second

router.get('/', async function (req, res) {
  const result = await getFeedEntries({ limit: LIMIT });
  await attachFeedMeta(result.entries);
  res.render('home.pug', {
    entries: result.entries,
    totalPages: Math.ceil(result.totalResults / LIMIT),
    filters: FEED_FILTERS,
    activeFilter: null,
    options: { isInFeed: true, isLoggedIn: req.isAuthenticated() },
  });
});

export default router;
