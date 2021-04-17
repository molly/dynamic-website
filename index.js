const express = require('express');
const path = require('path');
const https = require('https');
const fs = require('fs');

let config;
if (process.argv[2] === 'prod') {
  config = require('./config');
}
const getPaginatedAndFiltered = require('./data/utils/getPaginatedAndFiltered');
const PRESS_DEFAULTS = require('./data/pressDefaults');
const DIB_DEFAULTS = require('./data/dibDefaults');
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

app.get('/reading/dib', async (req, res) => {
  const results = await getPaginatedAndFiltered(
    '../dib.json',
    DIB_DEFAULTS,
    req
  );
  const selectedTags = req.query.tags ? req.query.tags.split('-') : [];
  res.render('dib.pug', {
    query: { ...req.query, tags: selectedTags },
    ...results,
  });
});

app.get('/reading/wikipedia', async (req, res) => {
  const results = await getPaginatedAndFiltered(
    '../books/wikipedia.json',
    BOOK_DEFAULTS,
    req
  );
  const selectedTags = req.query.tags ? req.query.tags.split('-') : [];
  const selectedStatuses = req.query.status ? req.query.status.split('-') : [];
  res.render('wikipedia-books.pug', {
    query: { ...req.query, tags: selectedTags, statuses: selectedStatuses },
    ...results,
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
