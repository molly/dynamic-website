import express from 'express';
import {
  getPaginatedAndFilteredFromDb,
  getRssEntriesFromDb,
} from '../../api/client.js';
import BOOK_DEFAULTS from '../../data/books/bookDefaults.js';
import {
  READING_STATUSES_LISTS,
  READING_STATUSES_MAP,
} from '../../data/constants/readingStatuses.js';
import getPaginatedAndFiltered from '../../data/filter/getPaginatedAndFiltered.js';
import getLandingPageSummary from '../../data/filter/landing.js';
import getRssResults from '../../data/filter/rss.js';

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

router.get('/blockchain', async (req, res) => {
  const results = await getPaginatedAndFilteredFromDb('blockchain', req);
  const selectedTags = req.query.tags ? req.query.tags.split('-') : [];
  res.render('blockchain.pug', {
    query: { ...req.query, tags: selectedTags },
    ...results,
  });
});

router.get('/nonfiction', async (req, res) => {
  const results = await getPaginatedAndFiltered(
    '../books/nonFiction.json',
    BOOK_DEFAULTS,
    req,
    { default: 5 },
  );
  const selectedTags = req.query.tags ? req.query.tags.split('-') : [];
  const selectedStatuses = req.query.status ? req.query.status.split('-') : [];
  res.render('reference-books.pug', {
    query: { ...req.query, tags: selectedTags, statuses: selectedStatuses },
    READING_STATUSES_LIST: READING_STATUSES_LISTS.reference,
    READING_STATUSES_MAP,
    ...results,
  });
});

router.get('/fiction', async (req, res) => {
  const results = await getPaginatedAndFiltered(
    '../books/fiction.json',
    BOOK_DEFAULTS,
    req,
    { default: 5 },
  );
  const selectedTags = req.query.tags ? req.query.tags.split('-') : [];
  const selectedStatuses = req.query.status ? req.query.status.split('-') : [];
  res.render('pleasure-books.pug', {
    query: { ...req.query, tags: selectedTags, statuses: selectedStatuses },
    READING_STATUSES_LIST: READING_STATUSES_LISTS.pleasure,
    READING_STATUSES_MAP,
    ...results,
  });
});

// RSS ========================================================================
router.get(
  ['/shortform/feed.xml', '/reading/dib/feed.xml'],
  async (req, res) => {
    const shortform = await getRssEntriesFromDb('shortform');
    const results = await getRssResults(shortform, 'rssArticle');
    res.set('Content-Type', 'text/xml');
    res.render('feed.pug', {
      prefix: 'shortform',
      results,
    });
  },
);

router.get('/blockchain/feed.xml', async (req, res) => {
  const blockchain = await getRssEntriesFromDb('blockchain');
  const results = await getRssResults(blockchain, 'rssBlockchainArticle');
  res.set('Content-Type', 'text/xml');
  res.render('feed.pug', {
    prefix: 'blockchain',
    results,
  });
});

export default router;
