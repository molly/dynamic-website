import { ServerApiVersion } from 'mongodb';
import auth from '../config/auth.config.js';

// No side effects on import, so the job queue workers can open their own short-lived
// connections without pulling in db.js.
const { mongoDbUser, mongoDbPassword, mongoDB } = auth;
if (!mongoDbUser || !mongoDbPassword || !mongoDB) {
  throw new Error(
    'mongoDbUser, mongoDbPassword and mongoDB must all be set in auth.config.js.',
  );
}

// The site's database.
export const siteDbName = mongoDB;

// Connection string for a database on the cluster. Defaults to the site's database; the copy
// script passes the names of the old databases it reads from.
export function mongoUri(dbName = siteDbName) {
  const user = encodeURIComponent(mongoDbUser);
  const password = encodeURIComponent(mongoDbPassword);
  return `mongodb+srv://${user}:${password}@cluster0.ptjwk.mongodb.net/${dbName}?retryWrites=true&w=majority`;
}

export const mongoOptions = { serverApi: ServerApiVersion.v1 };
