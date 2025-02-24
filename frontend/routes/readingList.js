import express from 'express';
import {
  getPaginatedAndFilteredBooksFromDb,
  getPaginatedAndFilteredFromDb,
} from '../../api/client.js';
import {
  READING_STATUSES_LISTS,
  READING_STATUSES_MAP,
} from '../../data/constants/readingStatuses.js';
import getLandingPageSummary from '../../data/filter/landing.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const results = await getLandingPageSummary();
  res.render('reading.pug', { READING_STATUSES_MAP, ...results });
});

router.get('/shortform', async (req, res) => {
  const results = await getPaginatedAndFilteredFromDb('shortform', req);
  const selectedTags = req.query.tags ? req.query.tags.split('-') : [];
  res.render('shortform.pug', {
    query: { ...req.query, tags: selectedTags },
    ...results,
  });
});

router.get('/books', async (req, res) => {
  const results = await getPaginatedAndFilteredBooksFromDb('books', req, {
    default: 10,
  });
  const selectedTags = req.query.tags ? req.query.tags.split('-') : [];
  const selectedStatuses = req.query.status ? req.query.status.split('-') : [];
  res.render('books.pug', {
    query: { ...req.query, tags: selectedTags, statuses: selectedStatuses },
    READING_STATUSES_LIST: READING_STATUSES_LISTS.pleasure,
    READING_STATUSES_MAP,
    ...results,
  });
});

// RSS ========================================================================
router.get(['/shortform/feed.xml', '/reading/dib/feed.xml'], (req, res) => {
  res.sendFile(
    new URL('../../rss/shortformFeed.xml', import.meta.url).pathname,
  );
});

export default router;
