const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const paginated = require('./pagination/middleware');
const paginate = require('./pagination/paginator');

const router = express.Router();

const getLocalJson = async (relativePath) => {
  const data = await fs.readFile(path.join(__dirname, relativePath), 'utf8');
  return JSON.parse(data);
};

router.get('/press', paginated, async (req, res) => {
  try {
    const press = await getLocalJson('../data/press.json');
    const paginatedPress = paginate(press, req);
    res.json(paginatedPress);
  } catch (err) {
    res.sendStatus(500);
  }
});

module.exports = router;
