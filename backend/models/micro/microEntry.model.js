import mongoose from 'mongoose';
import db from '../db.js';

const MicroEntrySchema = new mongoose.Schema(
  {
    title: { type: String },
    slug: { type: String, required: true, unique: true },
    post: { type: Object, required: true },
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MicroEntryTag',
      },
    ],
    relatedFeedPostIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'FeedEntry' },
    ],
    _id: { type: mongoose.Schema.Types.ObjectId, required: true },
  },
  { timestamps: true },
);

export default db.microConnection.model(
  'MicroEntry',
  MicroEntrySchema,
  'entries',
);
