import mongoose from 'mongoose';
import { ShortformSchema } from './entry.model.js';

const BlockchainEntry = mongoose.model(
  'BlockchainEntry',
  new mongoose.Schema(ShortformSchema),
  'blockchain',
);

export default BlockchainEntry;
