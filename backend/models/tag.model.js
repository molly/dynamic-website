import mongoose from 'mongoose';
import db from './db.js';

export const TagSchema = new mongoose.Schema({
  text: { type: String, required: true },
  value: { type: String, required: true, unique: true },
  frequency: {
    shortform: Number,
    blockchain: Number,
    micro: Number,
    citationNeeded: Number,
    press: Number,
    total: Number,
  },
});
export const Tag = db.tagConnection.model('Tag', TagSchema, 'tags');
export const BookTag = db.tagConnection.model('Tag', TagSchema, 'bookTags');
