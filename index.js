const express = require('express');
const path = require('path');
const https = require('https');
const fs = require('fs');

let config;
if (process.argv[2] === 'prod') {
  config = require('./config');
}

const getPaginatedAndFiltered = require('./data/filter/getPaginatedAndFiltered');
const getLandingPageSummary = require('./data/filter/landing');
const getWikipediaWriting = require('./data/filter/wikipediaWritingFilter');
const getRssResults = require('./data/filter/rss');

const {
  READING_STATUSES_MAP,
  READING_STATUSES_LISTS,
} = require('./data/constants/readingStatuses');
const PRESS_DEFAULTS = require('./data/pressDefaults');
const SHORTFORM_DEFAULTS = require('./data/shortformDefaults');
const BOOK_DEFAULTS = require('./data/books/bookDefaults');

const PORT = 5000;

const app = express();
app.use('/static', express.static(path.join(__dirname, 'js')));
app.set('views', path.join(__dirname, 'pug/views'));
app.set('view engine', 'pug');

app.get('/press', async (req, res) => {
  const results = await getPaginatedAndFiltered(
    '../press.json',
    PRESS_DEFAULTS,
    req
  );
  const selectedTags = req.query.tags ? req.query.tags.split('-') : [];
  res.render('press.pug', {
    query: { ...req.query, tags: selectedTags },
    ...results,
  });
});

app.get('/projects-press', async (req, res) => {
  const results = await getPaginatedAndFiltered(
    '../projectPress.json',
    PRESS_DEFAULTS,
    req
  );
  const selectedTags = req.query.tags ? req.query.tags.split('-') : [];
  res.render('projectPress.pug', {
    query: { ...req.query, tags: selectedTags },
    ...results,
  });
});

app.get('/reading', async (req, res) => {
  const results = await getLandingPageSummary();
  res.render('reading.pug', { READING_STATUSES_MAP, ...results });
});

app.get('/reading/shortform', async (req, res) => {
  const results = await getPaginatedAndFiltered(
    '../shortform.json',
    SHORTFORM_DEFAULTS,
    req
  );
  const selectedTags = req.query.tags ? req.query.tags.split('-') : [];
  res.render('shortform.pug', {
    query: { ...req.query, tags: selectedTags },
    ...results,
  });
});

app.get('/reading/reference', async (req, res) => {
  const results = await getPaginatedAndFiltered(
    '../books/reference.json',
    BOOK_DEFAULTS,
    req,
    { default: 5 }
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

app.get('/reading/work', async (req, res) => {
  const results = await getPaginatedAndFiltered(
    '../books/work.json',
    BOOK_DEFAULTS,
    req,
    { default: 5 }
  );
  const selectedTags = req.query.tags ? req.query.tags.split('-') : [];
  const selectedStatuses = req.query.status ? req.query.status.split('-') : [];
  res.render('work-books.pug', {
    query: { ...req.query, tags: selectedTags, statuses: selectedStatuses },
    READING_STATUSES_LIST: READING_STATUSES_LISTS.work,
    READING_STATUSES_MAP,
    ...results,
  });
});

app.get('/reading/pleasure', async (req, res) => {
  const results = await getPaginatedAndFiltered(
    '../books/pleasure.json',
    BOOK_DEFAULTS,
    req,
    { default: 5 }
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

app.get('/reading/shortform/feed.xml', async (req, res) => {
  const results = await getRssResults();
  res.set('Content-Type', 'text/xml');
  res.render('feed.pug', {
    prefix: 'shortform',
    results,
  });
});

app.get('/reading/dib/feed.xml', async (req, res) => {
  const results = await getRssResults();
  res.set('Content-Type', 'text/xml');
  res.render('feed.pug', {
    prefix: 'dib',
    results,
  });
});

if (process.argv[2] === 'prod') {
  https
    .createServer(
      {
        key: fs.readFileSync(`${config.certPath}/privkey.pem`),
        cert: fs.readFileSync(`${config.certPath}/cert.pem`),
        ca: fs.readFileSync(`${config.certPath}/chain.pem`),
      },
      app
    )
    .listen(PORT);
} else {
  app.listen(PORT);
}
