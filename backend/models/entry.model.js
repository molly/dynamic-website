import mongoose from 'mongoose';
import { generateRssForReading } from '../helpers/rss.js';
import db from './db.js';

export const EntrySchema = {
  title: { type: String, required: true },
  author: String,
  date: { type: String, required: true, match: /^\d{4}(-\d{2}){0,2}$/ },
  work: String,
  publisher: String,
  workItalics: Boolean,
  preposition: String,
  parenthetical: String,
  href: { type: String, match: /^https?/ },
  tags: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tag',
    },
  ],
  entryAdded: Date,
};

const ShortformBaseSchema = {
  ...EntrySchema,
  started: { type: String, required: true, match: /^\d{4}(-\d{2}){0,2}$/ },
  completed: { type: String, required: false, match: /^\d{4}(-\d{2}){0,2}$/ },
  status: {
    type: String,
    enum: ['read', 'currentlyReading', 'reference', 'shelved', 'toRead'],
  },
  relatedReading: [String],
};

const ShortformSchema = new mongoose.Schema({
  ...ShortformBaseSchema,
  summary: String,
});

ShortformSchema.post('save', async () => {
  await generateRssForReading();
});

export const ShortformEntry = db.readingListConnection.model(
  'ShortformEntry',
  ShortformSchema,
  'shortform',
);

export const PressEntry = db.readingListConnection.model(
  'PressEntry',
  new mongoose.Schema(EntrySchema),
  'press',
);
