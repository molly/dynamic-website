import mongoose from 'mongoose';

export const WebmentionSchema = new mongoose.Schema(
  {
    source: { type: String, required: true },
    target: { type: String, required: true },
    approved: { type: Boolean, default: false, required: true },
    // Rejected mentions are kept for a while so repeat sends of the same
    // source/target are ignored, then removed automatically by a TTL index.
    rejectedAt: { type: Date, expires: '90d' },
    body: {
      type: {
        type: String,
        enum: ['reply', 'like', 'repost', 'bookmark', 'mention'],
      },
      title: { type: String },
      siteName: { type: String },
      content: { type: String },
      summary: { type: String },
      author: { type: String },
      authorUrl: { type: String },
      published: { type: String },
      mentionUrl: { type: String },
    },
  },
  { timestamps: { createdAt: true } },
);
