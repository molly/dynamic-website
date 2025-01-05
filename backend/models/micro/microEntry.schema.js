import mongoose from 'mongoose';
import { NETWORKS } from '../../../api/helpers/socialMedia.js';
export const MicroEntrySchema = new mongoose.Schema(
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
          enum: NETWORKS,
        },
        postId: { type: String },
      },
    ],
    webmentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Webmention',
      },
    ],
    _id: { type: mongoose.Schema.Types.ObjectId, required: true },
    deletedAt: Date,
  },
  { timestamps: true },
);
