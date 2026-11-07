import mongoose from 'mongoose';
import db from './db.js';

// A group of related feed entries. Membership lives on FeedEntry.threads, and order is never
// stored: previous/next are the neighbouring entries by FeedEntry.createdAt, so an entry added in
// between later slots in on its own. Untitled threads only drive previous/next links.
export const ThreadSchema = new mongoose.Schema(
  {
    title: String,
    slug: { type: String, unique: true, sparse: true },
    description: String,
  },
  { timestamps: true },
);

export const Thread = db.connection.model('Thread', ThreadSchema, 'threads');
