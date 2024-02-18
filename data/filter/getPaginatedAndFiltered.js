const getLocalJson = require('../utils/getLocalJson');
const { paginate } = require('./paginate');
const { preprocess } = require('./preprocess');
const { filter } = require('./filter');

const getPaginatedAndFiltered = async (
  relativePath,
  defaults,
  req,
  paginationDefaults,
) => {
  const data = await getLocalJson(relativePath);
  let resp = preprocess(data, defaults);
  resp = { ...resp, ...filter(resp, req, defaults) };
  resp = { ...resp, ...paginate(resp, req, paginationDefaults) };
  return { ...resp, totalUnfilteredResults: data.length };
};

module.exports = getPaginatedAndFiltered;
