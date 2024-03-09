import mongoose from 'mongoose';

export const WebmentionSchema = new mongoose.Schema(
  {
    source: { type: String, required: true },
    target: { type: String, required: true },
    approved: { type: Boolean, default: false, required: true },
    body: { type: String },
  },
  { timestamps: { createdAt: true } },
);
