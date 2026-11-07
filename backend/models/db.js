import IORedis from 'ioredis';
import mongoose from 'mongoose';
import auth from '../config/auth.config.js';
import { mongoOptions, mongoUri } from './mongoUri.js';

const db = {
  mongoose,
  connection: mongoose.createConnection(mongoUri(), mongoOptions),
  redis: new IORedis(
    { port: 32856, password: auth.redisPassword },
    { maxRetriesPerRequest: null },
  ),
};

db.initialize = async function () {
  await db.connection.asPromise();
  console.log('initialized');
};

db.gracefulClose = async function () {
  await db.connection.close();
  console.log('db connections closed');
  process.exit(0);
};

export default db;
