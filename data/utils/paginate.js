const getLimit = (queryLimit) => {
  let limit;
  if (typeof queryLimit === 'string') {
    limit = parseInt(queryLimit, 10);
  } else if (Number.isInteger(queryLimit)) {
    limit = queryLimit;
  } else {
    limit = 10;
  }

  limit = Math.max(limit, 10);
  limit = Math.min(limit, 50);
  return limit;
};

const paginate = ({ results }, req) => {
  const limit = getLimit(req.query.limit);
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
