const mongoose = require('mongoose');
const { ShortformSchema } = require('./entry.model');

const BlockchainEntry = mongoose.model(
  'BlockchainEntry',
  new mongoose.Schema(ShortformSchema),
  'blockchain',
);

module.exports = BlockchainEntry;
