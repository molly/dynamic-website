import mongoose from 'mongoose';
import db from '../db.js';
import MicroEntry from '../micro/microEntry.model.js';

const FeedEntrySchema = new mongoose.Schema(
  {
    entryType: {
      type: String,
      enum: ['micro', 'blog', 'citationNeeded', 'reading'],
    },
  },
  { timestamps: true },
);
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
