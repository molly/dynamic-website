const mongoose = require('mongoose');
const { ShortformSchema } = require('./entry.model');

const ShortformEntry = mongoose.model(
  'ShortformEntry',
  new mongoose.Schema(ShortformSchema),
  'shortform'
);

module.exports = ShortformEntry;
