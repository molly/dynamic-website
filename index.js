const express = require('express');
const path = require('path');
const https = require('https');
const fs = require('fs');

const getPaginatedAndFiltered = require('./data/utils/getPaginatedAndFiltered');
const PRESS_DEFAULTS = require('./data/pressDefaults');

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

if (process.argv[2] === 'prod') {
  https
    .createServer(
      {
        key: fs.readFileSync(
          '/etc/letsencrypt/live/mollywhite.net/privkey.pem'
        ),
        cert: fs.readFileSync('/etc/letsencrypt/live/mollywhite.net/cert.pem'),
        ca: fs.readFileSync('/etc/letsencrypt/live/mollywhite.net/chain.pem'),
      },
      app
    )
    .listen(PORT);
} else {
  app.listen(PORT);
}
