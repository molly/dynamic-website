const mongoose = require('mongoose');

const db = {};
db.mongoose = mongoose;
db.User = require('./user.model');
db.RefreshToken = require('./refreshToken.model');
db.gracefulClose = function () {
  db.mongoose.connection.close(function () {
    console.log('db connection closed');
    process.exit(0);
  });
};

module.exports = db;
