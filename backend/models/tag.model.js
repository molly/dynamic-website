import mongoose from 'mongoose';

const TagSchema = new mongoose.Schema({
  text: String,
  value: String,
  frequency: Number,
});

export const BlockchainTag = mongoose.model(
  'BlockchainTag',
  TagSchema,
  'blockchainTags',
);
export const PressTag = mongoose.model('PressTag', TagSchema, 'pressTags');
export const ShortformTag = mongoose.model(
  'ShortformTag',
  TagSchema,
  'shortformTags',
);
