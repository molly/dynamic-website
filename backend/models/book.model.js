import mongoose from 'mongoose';
import db from './db.js';

export const BookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subtitle: String,
    author: String,
    editor: String,
    translator: String,
    format: { type: String, enum: ['print', 'digital', 'audio'] },
    date: { type: String, required: true, match: /^\d{4}(-\d{2}){0,2}$/ },
    publisher: String,
    imageSrc: String,
    href: String,
    started: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    completed: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    status: {
      type: String,
      enum: ['read', 'currentlyReading', 'dnf', 'reference', 'toRead'],
    },
    pages: Number,
    series: String,
    seriesNumber: Number,
    stars: Number,
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tag',
      },
    ],
    fiction: Boolean,
    border: Boolean,
    entryAdded: Date,
  },
  { timestamps: true },
);

export const Book = db.readingListConnection.model('Book', BookSchema, 'books');
