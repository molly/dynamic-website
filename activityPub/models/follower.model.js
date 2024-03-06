import mongoose from 'mongoose';
import db from '../../backend/models/db.js';

export const FollowerSchema = new mongoose.Schema({
  actor: { type: String, required: true, unique: true },
});

export const Follower = db.activityPubConnection.model(
  'Follower',
  FollowerSchema,
  'followers',
);
