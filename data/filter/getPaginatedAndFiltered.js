import getLocalJson from '../utils/getLocalJson.js';
import { filter } from './filter.js';
import { paginate } from './paginate.js';
import { preprocess } from './preprocess.js';

const getPaginatedAndFiltered = async (
  relativePath,
  defaults,
  req,
  paginationDefaults,
) => {
  const data = await getLocalJson(relativePath);
  let resp = preprocess(data, defaults, true);
  resp = { ...resp, ...filter(resp, req, defaults) };
  resp = { ...resp, ...paginate(resp, req, paginationDefaults) };
  return { ...resp, totalUnfilteredResults: data.length };
};

export default getPaginatedAndFiltered;
