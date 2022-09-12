const mongoose = require('mongoose');

const TagSchema = new mongoose.Schema({
  text: String,
  value: String,
  frequency: Number,
});

module.exports = {
  BlockchainTag: mongoose.model('BlockchainTag', TagSchema, 'blockchainTags'),
  PressTag: mongoose.model('PressTag', TagSchema, 'pressTags'),
  ShortformTag: mongoose.model('ShortformTag', TagSchema, 'shortformTags'),
};
