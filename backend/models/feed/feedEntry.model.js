import mongoose from 'mongoose';
import db from '../db.js';
import MicroEntry from '../micro/microEntry.model.js';

const FeedEntrySchema = new mongoose.Schema({}, { timestamps: true });

export const FeedEntry = db.feedConnection.model(
  'FeedEntry',
  FeedEntrySchema,
  'entries',
);

export const FeedEntryMicro = FeedEntry.discriminator(
  'FeedEntryMicro',
  new mongoose.Schema({
    micro: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MicroEntry,
      required: true,
    },
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
          enum: ['twitter', 'mastodon', 'bluesky', 'tiktok', 'youtube'],
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
    blockchain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BlockchainEntry',
    },
  }),
);
