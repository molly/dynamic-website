import getLocalJson from '../utils/getLocalJson.js';
import { paginate } from './paginate.js';
import { preprocess } from './preprocess.js';
import { filter } from './filter.js';

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

export default getPaginatedAndFiltered;
