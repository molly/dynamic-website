import mongoose from 'mongoose';
import { ShortformSchema } from './entry.model.js';

const ShortformEntry = mongoose.model(
  'ShortformEntry',
  new mongoose.Schema({ ...ShortformSchema, summary: String }),
  'shortform',
);

export default ShortformEntry;
