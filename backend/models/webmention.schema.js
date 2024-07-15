import mongoose from 'mongoose';

export const WebmentionSchema = new mongoose.Schema(
  {
    source: { type: String, required: true },
    target: { type: String, required: true },
    approved: { type: Boolean, default: false, required: true },
    body: {
      type: {
        type: String,
        enum: ['reply', 'like', 'repost', 'bookmark'],
      },
      content: { type: String },
      summary: { type: String },
      author: { type: String },
      authorUrl: { type: String },
      mentionUrl: { type: String },
    },
  },
  { timestamps: { createdAt: true } },
);
