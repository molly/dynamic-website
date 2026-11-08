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

export const PRESS_KINDS = [
  'article',
  'podcast',
  'radio',
  'video',
  'tv',
  'talk',
  'freelance',
];
export const PRESS_ROLES = [
  'quoted',
  'cited',
  'interviewed',
  'profiled',
  'panel member',
];

const PressSchema = new mongoose.Schema({
  ...EntrySchema,
  // The medium. The copy script sets this from parenthetical for existing entries.
  kind: {
    type: String,
    enum: PRESS_KINDS,
    default: 'article',
  },
  // Your part in it, when known. Set by hand.
  role: { type: String, enum: PRESS_ROLES },
  // Your piece that this press cited; drives "drew on" and the reverse "Cited by".
  drewOn: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeedEntry',
    index: true,
  },
  // The cards for your own pieces, talks and appearances (set on the tagger page). Most media is
  // linked out to: href, youtubeUrl. mediaUrl/audioUrl are for the rare copy you host yourself,
  // and only they get a player.
  leadImage: { type: String, match: /^https?:\/\// }, // Freelance pieces
  duration: Number, // Seconds; typed in for external media, read from a file you upload
  episode: String, // Podcasts: "426"
  location: String, // Upcoming talks
  slidesUrl: { type: String, match: /^https?:\/\// },
  transcriptUrl: { type: String, match: /^https?:\/\// },
  youtubeUrl: { type: String, match: /^https?:\/\// },
  mediaUrl: { type: String, match: /^https?:\/\// }, // Your own copy of a video
  posterUrl: { type: String, match: /^https?:\/\// },
  audioUrl: { type: String, match: /^https?:\/\// }, // Audio you've rehosted
  // Others in a talk or appearance (fellow panelists, guests), shown as "with …" after the host
  people: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Entity' }],
});

// The press fields the tagger page edits.
export const PRESS_CARD_FIELDS = [
  'kind',
  'role',
  'leadImage',
  'duration',
  'episode',
  'location',
  'slidesUrl',
  'transcriptUrl',
  'youtubeUrl',
  'mediaUrl',
  'posterUrl',
  'audioUrl',
  'people',
];

export const PressEntry = db.connection.model(
  'PressEntry',
  PressSchema,
  'press',
);
