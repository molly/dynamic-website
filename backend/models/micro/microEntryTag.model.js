import mongoose from 'mongoose';
import db from '../db.js';

const TagSchema = new mongoose.Schema({
  text: { type: String, required: true },
  value: { type: String, required: true, unique: true },
  frequency: { type: Number, required: true },
});

export default db.microConnection.model('MicroEntryTag', TagSchema, 'tags');
