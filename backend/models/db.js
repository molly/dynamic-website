import { ServerApiVersion } from 'mongodb';
import mongoose from 'mongoose';

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
  activityPubConnection: mongoose.createConnection(
    `mongodb+srv://reading-list:${process.env.PASSWORD}@cluster0.ptjwk.mongodb.net/activityPub?retryWrites=true&w=majority`,
    {
      serverApi: ServerApiVersion.v1,
    },
  ),
};

db.initialize = async function () {
  await Promise.all([
    db.authConnection.asPromise(),
    db.readingListConnection.asPromise(),
    db.microConnection.asPromise(),
    db.feedConnection.asPromise(),
    db.tagConnection.asPromise(),
    db.activityPubConnection.asPromise(),
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
    db.activityPubConnection.close(),
  ]);
  console.log('db connections closed');
  process.exit(0);
};

export default db;
