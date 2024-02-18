import mongoose from 'mongoose';
import { EntrySchema } from './entry.model.js';

const PressEntry = mongoose.model(
  'PressEntry',
  new mongoose.Schema({
    ...EntrySchema,
  }),
  'press',
);

export default PressEntry;
