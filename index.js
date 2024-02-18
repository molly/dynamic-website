import express from 'express';
import fs from 'fs';
import https from 'https';
import config from './backend/config/auth.config.js';

import {
  getPaginatedAndFilteredFromDb,
  getRssEntriesFromDb,
} from './api/client.js';
import db from './backend/models/db.js';
import backendRouter from './backend/routes/router.js';
import BOOK_DEFAULTS from './data/books/bookDefaults.js';
import {
  READING_STATUSES_LISTS,
  READING_STATUSES_MAP,
} from './data/constants/readingStatuses.js';
import getPaginatedAndFiltered from './data/filter/getPaginatedAndFiltered.js';
import getLandingPageSummary from './data/filter/landing.js';
import getRssResults from './data/filter/rss.js';
import getWikipediaWriting from './data/filter/wikipediaWritingFilter.js';

const PORT = process.env.PORT || 5001;

const app = express();
app.use('/static', express.static('js'));
app.use('/static', express.static('css'));
app.set('views', 'pug/views');
app.set('view engine', 'pug');

app.get('/press', async (req, res) => {
  const results = await getPaginatedAndFilteredFromDb('press', req);
  const selectedTags = req.query.tags ? req.query.tags.split('-') : [];
  res.render('press.pug', {
    query: { ...req.query, tags: selectedTags },
    ...results,
  });
});

app.get('/reading', async (req, res) => {
  const results = await getLandingPageSummary();
  res.render('reading.pug', { READING_STATUSES_MAP, ...results });
});

app.get('/reading/shortform', async (req, res) => {
  const results = await getPaginatedAndFilteredFromDb('shortform', req);
  const selectedTags = req.query.tags ? req.query.tags.split('-') : [];
  res.render('shortform.pug', {
    query: { ...req.query, tags: selectedTags },
    ...results,
  });
});

app.get('/reading/blockchain', async (req, res) => {
  const results = await getPaginatedAndFilteredFromDb('blockchain', req);
  const selectedTags = req.query.tags ? req.query.tags.split('-') : [];
  res.render('blockchain.pug', {
    query: { ...req.query, tags: selectedTags },
    ...results,
  });
});

app.get('/reading/nonfiction', async (req, res) => {
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

app.get('/reading/fiction', async (req, res) => {
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

app.get('/wikipedia-work', async (req, res) => {
  const results = await getWikipediaWriting(req, { default: 20 });
  const selectedTopics = req.query.tags ? req.query.tags.split('-') : [];
  res.render('wikipedia-writing.pug', {
    query: { ...req.query, topics: selectedTopics },
    ...results,
  });
});

app.get(
  ['/reading/shortform/feed.xml', '/reading/dib/feed.xml'],
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

app.get('/reading/blockchain/feed.xml', async (req, res) => {
  const blockchain = await getRssEntriesFromDb('blockchain');
  const results = await getRssResults(blockchain, 'rssBlockchainArticle');
  res.set('Content-Type', 'text/xml');
  res.render('feed.pug', {
    prefix: 'blockchain',
    results,
  });
});

app.use('/dynamic-api', backendRouter);

if (process.argv[2] === 'prod') {
  https
    .createServer(
      {
        key: fs.readFileSync(
          new URL(`${config.certPath}/privkey.pem`, import.meta.url),
        ),
        cert: fs.readFileSync(
          new URL(`${config.certPath}/cert.pem`, import.meta.url),
        ),
        ca: fs.readFileSync(
          new URL(`${config.certPath}/chain.pem`, import.meta.url),
        ),
      },
      app,
    )
    .listen(PORT);
} else {
  app.listen(PORT);
}

process.on('SIGINT', db.gracefulClose).on('SIGTERM', db.gracefulClose);
