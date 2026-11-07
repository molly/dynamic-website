import mongoose from 'mongoose';
import db from './db.js';

export const TagSchema = new mongoose.Schema({
  text: { type: String, required: true },
  value: { type: String, required: true, unique: true },
  frequency: {
    shortform: Number,
    micro: Number,
    citationNeeded: Number,
    press: Number,
    total: Number,
  },
});
export const Tag = db.connection.model('Tag', TagSchema, 'tags');
export const BookTag = db.connection.model('BookTag', TagSchema, 'bookTags');
