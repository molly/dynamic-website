const express = require('express');
const path = require('path');

const getPaginatedAndFiltered = require('./data/utils/getPaginatedAndFiltered');
const PRESS_DEFAULTS = require('./data/pressDefaults');

const PORT = process.env.PORT || 5000;

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
  console.log(results);
  res.render('press.pug', {
    query: { ...req.query, tags: selectedTags },
    ...results,
  });
});

app.listen(PORT);

module.exports = app;
