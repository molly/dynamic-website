import mongoose from 'mongoose';
import User from './user.model.js';
import RefreshToken from './refreshToken.model.js';
import ShortformEntry from './shortformEntry.model.js';
import BlockchainEntry from './blockchainEntry.model.js';
import PressEntry from './pressEntry.model.js';
import { BlockchainTag, PressTag, ShortformTag } from './tag.model.js';

const db = {
  mongoose,
  User,
  RefreshToken,
  ShortformEntry,
  BlockchainEntry,
  PressEntry,
  BlockchainTag,
  PressTag,
  ShortformTag,
};

db.gracefulClose = async function () {
  await db.mongoose.connection.close();
  console.log('db connection closed');
  process.exit(0);
};

export default db;
