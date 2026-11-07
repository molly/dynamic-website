import mongoose from 'mongoose';
import { NETWORKS } from '../../../api/helpers/socialMedia.js';
import { generateRssForFeed } from '../../helpers/rss.js';
import db from '../db.js';
import MicroEntry from '../micro/microEntry.model.js';

const FeedEntrySchema = new mongoose.Schema(
  {
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tag',
      },
    ],
    // Groups of related entries. Previous/next within a thread are worked out from createdAt,
    // never stored. An entry can be in several threads.
    threads: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Thread',
      },
    ],
    // Entities this entry is about: drives the "about" sidebar and entity pages.
    about: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Entity',
      },
    ],
  },
  { timestamps: true },
);
FeedEntrySchema.index({ threads: 1, createdAt: 1 });
FeedEntrySchema.index({ about: 1, createdAt: -1 });

// Generate RSS on each save
FeedEntrySchema.post('save', generateRssForFeed);
export const FeedEntry = db.connection.model(
  'FeedEntry',
  FeedEntrySchema,
  'feedEntries',
);

export const FeedEntryMicro = FeedEntry.discriminator(
  'FeedEntryMicro',
  new mongoose.Schema({
    micro: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MicroEntry,
      required: true,
    },
    deletedAt: Date,
  }),
);

export const FeedEntryCitationNeeded = FeedEntry.discriminator(
  'FeedEntryCitationNeeded',
  new mongoose.Schema({
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    excerpt: { type: String },
    image: { type: String },
    imageAlt: { type: String },
    socialLinks: [
      {
        type: {
          type: String,
          enum: NETWORKS,
        },
        postId: { type: String },
      },
    ],
  }),
);

export const FeedEntryReading = FeedEntry.discriminator(
  'FeedEntryReading',
  new mongoose.Schema({
    shortform: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShortformEntry',
    },
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
    },
    status: {
      type: String,
      enum: ['read', 'currentlyReading', 'dnf', 'reference', 'toRead'],
    },
  }),
);

export const FeedEntryPress = FeedEntry.discriminator(
  'FeedEntryPress',
  new mongoose.Schema({
    press: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PressEntry',
      required: true,
    },
  }),
);
