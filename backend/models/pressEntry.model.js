const mongoose = require('mongoose');
const { EntrySchema } = require('./entry.model');

const PressEntry = mongoose.model(
  'PressEntry',
  new mongoose.Schema({
    ...EntrySchema,
  }),
  'press',
);

module.exports = PressEntry;
