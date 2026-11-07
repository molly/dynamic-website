import mongoose from 'mongoose';

// One record per archived URL. Nothing references these by id: entries, reading, press and post
// blocks store plain URLs and are joined to their archive by `url` at render time. The schema is
// separate from the model so the job queue can register it on its own connection.
export const ARCHIVED_LINK_COLLECTION = 'archivedLinks';

export const ArchivedLinkSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, unique: true },
    archiveUrl: String, // Wayback Machine capture
    archivedAt: Date,
    status: {
      type: String,
      enum: ['queued', 'ok', 'failed'],
      required: true,
      default: 'queued',
    },
    error: String,
    lastCheckedAt: Date,
  },
  { timestamps: true },
);
