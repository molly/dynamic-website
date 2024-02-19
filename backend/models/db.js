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
};

db.initialize = async function () {
  await Promise.all([
    db.authConnection.asPromise(),
    db.readingListConnection.asPromise(),
    db.microConnection.asPromise(),
  ]);
  console.log('initialized');
};

db.gracefulClose = async function () {
  await db.mongoose.connection.close();
  console.log('db connection closed');
  process.exit(0);
};

export default db;
