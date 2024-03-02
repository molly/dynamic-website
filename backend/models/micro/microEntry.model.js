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
        ref: 'Tag',
      },
    ],
    readingListReference: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'readingListReference.model',
      },
      model: {
        type: String,
        enum: ['ShortformEntry', 'BlockchainEntry', 'PressEntry'],
      },
    },
    socialLinks: [
      {
        type: {
          type: String,
          enum: ['twitter', 'mastodon', 'bluesky', 'tiktok', 'youtube'],
        },
        postId: { type: String },
      },
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
