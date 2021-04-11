const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const PRESS_DEFAULTS = require('../data/pressDefaults');
const DIB = require('../data/dibDefaults');

const paginate = require('./utils/paginate');
const preprocess = require('./utils/preprocess');
const filter = require('./utils/filter');

const router = express.Router();

const getLocalJson = async (relativePath) => {
  const data = await fs.readFile(path.join(__dirname, relativePath), 'utf8');
  return JSON.parse(data);
};

const getPaginatedAndFiltered = async (relativePath, defaults, req) => {
  const data = await getLocalJson(relativePath);
  let resp = preprocess(data, defaults);
  resp = { ...resp, ...filter(resp, req) };
  resp = { ...resp, ...paginate(resp, req) };
  return { ...resp, totalUnfilteredResults: data.length };
};

router.get('/press', async (req, res) => {
  try {
    const results = await getPaginatedAndFiltered(
      '../data/press.json',
      PRESS_DEFAULTS,
      req
    );
    res.json(results);
  } catch (err) {
    res.status(500).send(err);
  }
});

router.get('/dib', async (req, res) => {
  try {
    const results = await getPaginatedAndFiltered('../data/dib.json', DIB, req);
    res.json(results);
  } catch (err) {
    res.status(500).send(err);
  }
});

module.exports = router;
