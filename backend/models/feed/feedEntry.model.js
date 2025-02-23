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
  },
  { timestamps: true },
);

// Generate RSS on each save
FeedEntrySchema.post('save', generateRssForFeed);
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
    blockchain: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BlockchainEntry',
    },
    book: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
    },
  }),
);
