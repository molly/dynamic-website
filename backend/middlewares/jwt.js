const jwt = require('jsonwebtoken');
const config = require('../config/auth.config.js');

const verifyJwt = (req, res, next) => {
  const bearerHeader = req.headers['authorization'];
  if (!bearerHeader) {
    return res.status(403).send({ message: 'Token missing from request' });
  }

  const splitHeader = bearerHeader.split(' ');
  if (splitHeader.length < 2) {
    return res.status(403).send({ message: 'Malformed token' });
  }
  const token = splitHeader[1];

  jwt.verify(token, config.secret, (err, decoded) => {
    if (err) {
      if (err instanceof jwt.TokenExpiredError) {
        return res.status(401).send({ message: 'Expired token' });
      }
      return res.status(401).send({ message: 'Unauthorized' });
    }
    req.userId = decoded.id;
    next();
  });
};

module.exports = { verifyJwt };
