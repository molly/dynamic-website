const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const PRESS_DEFAULTS = require('../data/pressDefaults');
// const DIB = require('../data/dib');

const paginate = require('./utils/paginate');
const preprocess = require('./utils/preprocess');

const router = express.Router();

const getLocalJson = async (relativePath) => {
  const data = await fs.readFile(path.join(__dirname, relativePath), 'utf8');
  return JSON.parse(data);
};

const getPaginatedAndFiltered = async (relativePath, defaults, req) => {
  const data = await getLocalJson(relativePath);
  let resp = preprocess(data, defaults);
  // resp = { ...resp, ...filter(resp, req) };
  resp = { ...resp, ...paginate(resp, req) };
  return resp;
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
    console.log(err);
    res.sendStatus(500);
  }
});

router.get('/dib', async (req, res) => {
  try {
    const results = await getPaginatedAndFiltered(
      '../data/dib.json',
      null,
      req
    );
    res.json(results);
  } catch (err) {
    console.log(err);
    res.sendStatus(500);
  }
});

module.exports = router;
