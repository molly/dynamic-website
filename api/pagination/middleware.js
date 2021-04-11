const paginated = (req, res, next) => {
  if (
    !req.query.limit ||
    !Number.isInteger(req.query.limit) ||
    req.query.limit <= 5
  ) {
    req.query.limit = 5;
  }
  if (req.query.limit > 50) {
    req.query.limit = 50;
  }
  next();
};

module.exports = paginated;
