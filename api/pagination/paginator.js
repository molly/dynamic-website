const paginate = (data, req) => {
  const { limit, page } = req.query;
  return {
    currentPage: page,
    pageSize: limit,
    results: data.slice((page - 1) * limit, limit),
    totalPages: Math.ceil(data.length / limit),
    totalResults: data.length,
  };
};

module.exports = paginate;
