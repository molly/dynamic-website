const mongoose = require('mongoose');

const db = {};
db.mongoose = mongoose;
db.User = require('./user.model');
db.RefreshToken = require('./refreshToken.model');

db.ShortformEntry = require('./shortformEntry.model');
db.BlockchainEntry = require('./blockchainEntry.model');
db.PressEntry = require('./pressEntry.model');
db.BlockchainTag = require('./tag.model').BlockchainTag;
db.PressTag = require('./tag.model').PressTag;
db.ShortformTag = require('./tag.model').ShortformTag;

db.gracefulClose = async function () {
  await db.mongoose.connection.close();
  console.log('db connection closed');
  process.exit(0);
};

module.exports = db;
