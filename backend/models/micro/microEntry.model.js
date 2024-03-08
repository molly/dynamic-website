import mongoose from 'mongoose';
import { generateRssForFeed, generateRssForMicro } from '../../helpers/rss.js';
import { sendWebmentions } from '../../helpers/webmentions.js';
import db from '../db.js';

const MicroEntrySchema = new mongoose.Schema(
  {
    title: String,
    slug: { type: String, required: true, unique: true },
    post: { type: Object },
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tag',
      },
    ],
    relatedPost: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'relatedPostModel',
    },
    relatedPostModel: {
      type: String,
      enum: ['ShortformEntry', 'BlockchainEntry', 'PressEntry'],
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
    deletedAt: Date,
  },
  { timestamps: true },
);

MicroEntrySchema.pre('save', async function () {
  await sendWebmentions(this);
});

// Generate RSS after each save.
// Don't need to wait for it to complete.
MicroEntrySchema.post('save', function () {
  generateRssForFeed();
  generateRssForMicro();
});

export default db.microConnection.model(
  'MicroEntry',
  MicroEntrySchema,
  'entries',
);
