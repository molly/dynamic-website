const getLimit = (queryLimit, defaults) => {
  let limit;
  if (typeof queryLimit === 'string') {
    limit = parseInt(queryLimit, 10);
  } else if (Number.isInteger(queryLimit)) {
    limit = queryLimit;
  } else {
    limit = defaults.default || 10;
  }

  limit = Math.max(limit, defaults.min || 5);
  limit = Math.min(limit, defaults.max || 50);
  return limit;
};

const paginate = ({ results }, req, defaults = {}) => {
  const limit = getLimit(req.query.limit, defaults);
  const page = req.query.page ? parseInt(req.query.page, 10) : 1;
  const start = (page - 1) * limit;
  return {
    currentPage: page,
    pageSize: limit,
    results: results.slice(start, start + limit),
    totalPages: Math.ceil(results.length / limit),
    totalResults: results.length,
  };
};

module.exports = paginate;
