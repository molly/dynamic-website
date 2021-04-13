const paginate = ({ results }, req) => {
  const limit =
    typeof req.query.limit === 'string'
      ? parseInt(req.query.limit, 10)
      : req.query.limit;
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
