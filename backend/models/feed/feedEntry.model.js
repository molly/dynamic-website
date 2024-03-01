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
    micro: { type: mongoose.Schema.Types.ObjectId, ref: MicroEntry },
  }),
);

export const FeedEntryCitationNeeded = FeedEntry.discriminator(
  'FeedEntryCitationNeeded',
  new mongoose.Schema({
    title: { type: String },
    slug: { type: String, required: true, unique: true },
    excerpt: { type: String },
    image: { type: String },
  }),
);
