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
  // Outlet entity, matched from href's domain when the entry is added.
  outlet: { type: mongoose.Schema.Types.ObjectId, ref: 'Entity' },
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
  summary: String, // Your own commentary
  subtitle: String,
  excerpts: [String], // Quoted passages; "read in context" links are derived from these
  paywalled: Boolean, // Unset means use the outlet's paywalledByDefault
  giftLink: { type: String, match: /^https?:\/\// },
});

ShortformSchema.post('save', async () => {
  await generateRssForReading();
});

export const ShortformEntry = db.connection.model(
  'ShortformEntry',
  ShortformSchema,
  'shortform',
);

const PressSchema = new mongoose.Schema({
  ...EntrySchema,
  // The medium. The copy script sets this from parenthetical for existing entries.
  kind: {
    type: String,
    enum: ['article', 'podcast', 'radio', 'video', 'tv', 'talk', 'freelance'],
    default: 'article',
  },
  // Your part in it, when known. Set by hand.
  role: { type: String, enum: ['quoted', 'cited', 'interviewed', 'profiled'] },
  // Your piece that this press cited; drives "drew on" and the reverse "Cited by".
  drewOn: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeedEntry',
    index: true,
  },
});

export const PressEntry = db.connection.model(
  'PressEntry',
  PressSchema,
  'press',
);
