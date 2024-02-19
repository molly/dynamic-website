import mongoose from 'mongoose';
import db from './db.js';

const TagSchema = new mongoose.Schema({
  text: String,
  value: String,
  frequency: Number,
});

export const BlockchainTag = db.readingListConnection.model(
  'BlockchainTag',
  TagSchema,
  'blockchainTags',
);
export const PressTag = db.readingListConnection.model(
  'PressTag',
  TagSchema,
  'pressTags',
);
export const ShortformTag = db.readingListConnection.model(
  'ShortformTag',
  TagSchema,
  'shortformTags',
);
