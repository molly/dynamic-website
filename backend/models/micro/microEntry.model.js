import mongoose from 'mongoose';
import db from '../db.js';

const MicroEntrySchema = {
  title: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  post: { type: Object, required: true },
  tags: [String],
  relatedFeedPostIds: [
    { type: mongoose.Schema.Types.ObjectId, ref: 'FeedEntry' },
  ],
  _id: { type: mongoose.Schema.Types.ObjectId, required: true },
};

export default db.microConnection.model(
  'MicroEntry',
  new mongoose.Schema(MicroEntrySchema, { timestamps: true }),
  'entries',
);
