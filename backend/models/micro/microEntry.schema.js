import mongoose from 'mongoose';
import {
  MENTION_NETWORKS,
  NETWORKS,
} from '../../../api/helpers/socialMedia.js';
// Shared with the job queue, which registers its own copy of the model.
export const MICRO_ENTRY_COLLECTION = 'microEntries';

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
    // Articles and press pieces this post discusses, shown as cards.
    relatedPosts: [
      {
        _id: false,
        ref: {
          type: mongoose.Schema.Types.ObjectId,
          refPath: 'relatedPosts.model',
          required: true,
        },
        model: {
          type: String,
          enum: ['ShortformEntry', 'PressEntry'],
          required: true,
        },
      },
    ],
    sources: [
      {
        _id: false,
        label: { type: String, required: true },
        url: { type: String, required: true, match: /^https?:\/\// },
      },
    ],
    data: {
      label: String,
      url: { type: String, match: /^https?:\/\// },
    },
    // Someone else's post this replies to. Their words aren't copied in.
    inReplyTo: {
      name: String,
      network: { type: String, enum: MENTION_NETWORKS },
      url: { type: String, match: /^https?:\/\// },
      postedAt: Date,
    },
    updates: [
      {
        kind: {
          type: String,
          enum: ['update', 'correction', 'live'],
          required: true,
        },
        at: { type: Date, required: true },
        headline: String, // Live updates only
        body: { type: Object, required: true }, // EditorJS data
      },
    ],
    live: {
      status: { type: String, enum: ['updating', 'ended'] },
      startedAt: Date,
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
