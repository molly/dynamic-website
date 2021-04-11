const paginate = ({ results }, req) => {
  const { limit, page } = req.query;
  return {
    currentPage: page,
    pageSize: limit,
    results: results.slice((page - 1) * limit, limit),
    totalPages: Math.ceil(results.length / limit),
    totalResults: results.length,
  };
};

module.exports = paginate;
