const paginated = (req, __, next) => {
  const limit = req.query.limit && parseInt(req.query.limit, 10);
  if (!limit || !Number.isInteger(limit) || limit <= 5) {
    req.query.limit = 5;
  }
  if (req.query.limit > 50) {
    req.query.limit = 50;
  }
  next();
};

module.exports = paginated;
