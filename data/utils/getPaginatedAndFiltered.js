const fs = require('fs').promises;
const path = require('path');

const paginate = require('./paginate');
const preprocess = require('./preprocess');
const filter = require('./filter');

const getLocalJson = async (relativePath) => {
  const data = await fs.readFile(path.join(__dirname, relativePath), 'utf8');
  return JSON.parse(data);
};

const getPaginatedAndFiltered = async (
  relativePath,
  defaults,
  req,
  paginationDefaults = null
) => {
  const data = await getLocalJson(relativePath);
  let resp = preprocess(data, defaults);
  resp = { ...resp, ...filter(resp, req, defaults) };
  resp = { ...resp, ...paginate(resp, req, paginationDefaults) };
  return { ...resp, totalUnfilteredResults: data.length };
};

module.exports = getPaginatedAndFiltered;
