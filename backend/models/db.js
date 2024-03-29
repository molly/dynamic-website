import IORedis from 'ioredis';
import { ServerApiVersion } from 'mongodb';
import mongoose from 'mongoose';
import auth from '../config/auth.config.js';

const db = {
  mongoose,
  authConnection: mongoose.createConnection(
    `mongodb+srv://reading-list:${process.env.PASSWORD}@cluster0.ptjwk.mongodb.net/auth?retryWrites=true&w=majority`,
    {
      serverApi: ServerApiVersion.v1,
    },
  ),
  readingListConnection: mongoose.createConnection(
    `mongodb+srv://reading-list:${process.env.PASSWORD}@cluster0.ptjwk.mongodb.net/reading-list?retryWrites=true&w=majority`,
    {
      serverApi: ServerApiVersion.v1,
    },
  ),
  microConnection: mongoose.createConnection(
    `mongodb+srv://reading-list:${process.env.PASSWORD}@cluster0.ptjwk.mongodb.net/micro?retryWrites=true&w=majority`,
    {
      serverApi: ServerApiVersion.v1,
    },
  ),
  feedConnection: mongoose.createConnection(
    `mongodb+srv://reading-list:${process.env.PASSWORD}@cluster0.ptjwk.mongodb.net/feed?retryWrites=true&w=majority`,
    {
      serverApi: ServerApiVersion.v1,
    },
  ),
  tagConnection: mongoose.createConnection(
    `mongodb+srv://reading-list:${process.env.PASSWORD}@cluster0.ptjwk.mongodb.net/tags?retryWrites=true&w=majority`,
    {
      serverApi: ServerApiVersion.v1,
    },
  ),
  webmentionConnection: mongoose.createConnection(
    `mongodb+srv://reading-list:${process.env.PASSWORD}@cluster0.ptjwk.mongodb.net/webmentions?retryWrites=true&w=majority`,
    {
      serverApi: ServerApiVersion.v1,
    },
  ),
  redis: new IORedis(
    { port: 32856, password: auth.redisPassword },
    { maxRetriesPerRequest: null },
  ),
};

db.initialize = async function () {
  await Promise.all([
    db.authConnection.asPromise(),
    db.readingListConnection.asPromise(),
    db.microConnection.asPromise(),
    db.feedConnection.asPromise(),
    db.tagConnection.asPromise(),
    db.webmentionConnection.asPromise(),
  ]);
  console.log('initialized');
};

db.gracefulClose = async function () {
  await Promise.all([
    db.authConnection.close(),
    db.readingListConnection.close(),
    db.microConnection.close(),
    db.feedConnection.close(),
    db.tagConnection.close(),
    db.webmentionConnection.close(),
  ]);
  console.log('db connections closed');
  process.exit(0);
};

export default db;
