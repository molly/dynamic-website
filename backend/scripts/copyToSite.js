// One-way copy from the six old databases into the site database (mongoDB in auth.config.js).
//
//   node backend/scripts/copyToSite.js [--dry-run]
//
// Safe to re-run while the old site stays live:
// - It never writes to the old databases. Run it as a user with read-only access to them.
// - Documents are upserted by _id. Only fields that came from the old document are written, so
//   fields added in the site database (threads, archives, entities) are never overwritten.
// - A field removed from an old document since the last run is removed from the copy too. The
//   copyState collection records which fields each copy got from the old database, to tell
//   these apart from fields added later.
// - Documents deleted from the old databases are reported, not deleted from the copy.
// - Some collections are reshaped on the way (see the transforms below). Fields a transform
//   produces count as coming from the old database, so the old site stays their source of truth
//   until cutover: edits to them in the site database are overwritten on the next run.

import mongoose from 'mongoose';
import {
  mapPostText,
  parseLegacyMentions,
} from '../../api/helpers/mentions.js';
import { resolveLegacyMentions } from '../helpers/legacyMentions.js';
import db from '../models/db.js';
import { mongoOptions, mongoUri, siteDbName } from '../models/mongoUri.js';
import { transformMicroEntry, transformPressEntry } from './copyTransforms.js';

// Old-format mentions are turned into entities before micro entries are copied, so the copies can
// point at them. Prints what it did.
async function prepareMicroMentions(fromCollection) {
  const mentions = [];
  for await (const doc of fromCollection.find({ post: { $exists: true } })) {
    mapPostText(doc.post, (html) => {
      for (const mention of parseLegacyMentions(html)) {
        mentions.push({ ...mention, where: doc.slug });
      }
      return html;
    });
  }
  const { ids, created, updated, ambiguous } = await resolveLegacyMentions(
    mentions,
    { dryRun },
  );
  console.log(
    `Mentions: ${mentions.length} old-format, ${ids.size} distinct; ${created.length} ${dryRun ? 'would be created' : 'created'} as mention-only people, ${updated.length} existing entities given more accounts, ${ambiguous.length} ambiguous`,
  );
  if (created.length) {
    console.log(
      `  ${dryRun ? 'would create' : 'created'} (all as people; change the type in the entity admin if needed): ${created.join(', ')}`,
    );
  }
  for (const { where, name, candidates } of ambiguous) {
    console.log(
      `  ambiguous in ${where}: "${name}" could be ${candidates.join(' or ')} (left in the old format)`,
    );
  }
  return ids;
}

const SOURCES = [
  {
    db: 'micro',
    collection: 'entries',
    target: 'microEntries',
    prepare: prepareMicroMentions,
    transform: transformMicroEntry,
  },
  { db: 'feed', collection: 'entries', target: 'feedEntries' },
  { db: 'reading-list', collection: 'shortform', target: 'shortform' },
  {
    db: 'reading-list',
    collection: 'press',
    target: 'press',
    transform: transformPressEntry,
  },
  { db: 'reading-list', collection: 'books', target: 'books' },
  { db: 'tags', collection: 'tags', target: 'tags' },
  { db: 'tags', collection: 'bookTags', target: 'bookTags' },
  { db: 'auth', collection: 'users', target: 'users' },
  { db: 'webmentions', collection: 'webmentions', target: 'webmentions' },
];

// Old collections deliberately left behind. Sessions are short-lived; you log in again.
const NOT_COPIED = [{ db: 'auth', collection: 'sessions' }];

const OLD_DATABASES = [...new Set(SOURCES.map((s) => s.db))];
const BATCH_SIZE = 100;
const PAUSE_MS = 500; // Between batches, to stay well under the free tier's operations cap
const STATE_COLLECTION = 'copyState';

const dryRun = process.argv.includes('--dry-run');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function assertSafeTarget() {
  if (OLD_DATABASES.includes(siteDbName)) {
    throw new Error(
      `mongoDB in auth.config.js is "${siteDbName}", one of the old databases. Point it at the site database.`,
    );
  }
}

// Fail loudly on any old collection this script doesn't know about, rather than skip it.
async function findUnmappedCollections(sourceDbs) {
  const unmapped = [];
  for (const [dbName, conn] of Object.entries(sourceDbs)) {
    const collections = await conn.db.listCollections().toArray();
    for (const { name } of collections) {
      const known =
        SOURCES.some((s) => s.db === dbName && s.collection === name) ||
        NOT_COPIED.some((s) => s.db === dbName && s.collection === name);
      if (!known) {
        unmapped.push(`${dbName}.${name}`);
      }
    }
  }
  return unmapped;
}

async function copyCollection(source, sourceDb, targetDb) {
  const from = sourceDb.collection(source.collection);
  const to = targetDb.collection(source.target);
  const state = targetDb.collection(STATE_COLLECTION);
  const stats = { upserted: 0, modified: 0, unchanged: 0, missingFromOld: 0 };
  const seenIds = new Set();

  const context = source.prepare ? await source.prepare(from) : undefined;
  const cursor = from.find({}).batchSize(BATCH_SIZE);
  let batch = [];
  const flush = async () => {
    if (batch.length === 0) {
      return;
    }
    const stateIds = batch.map((doc) => `${source.target}:${doc._id}`);
    const previous = await state.find({ _id: { $in: stateIds } }).toArray();
    const previousFields = new Map(previous.map((p) => [p._id, p.fields]));

    const writes = [];
    const stateWrites = [];
    for (const doc of batch) {
      const stateId = `${source.target}:${doc._id}`;
      const { _id, ...fields } = source.transform
        ? source.transform(doc, context)
        : doc;
      const fieldNames = Object.keys(fields);
      const removed = (previousFields.get(stateId) || []).filter(
        (name) => !(name in fields),
      );
      const update = { $set: fields };
      if (removed.length > 0) {
        update.$unset = Object.fromEntries(removed.map((name) => [name, '']));
      }
      writes.push({
        updateOne: { filter: { _id }, update, upsert: true },
      });
      stateWrites.push({
        updateOne: {
          filter: { _id: stateId },
          update: { $set: { fields: fieldNames } },
          upsert: true,
        },
      });
    }

    if (!dryRun) {
      const result = await to.bulkWrite(writes, { ordered: false });
      await state.bulkWrite(stateWrites, { ordered: false });
      stats.upserted += result.upsertedCount;
      stats.modified += result.modifiedCount;
      stats.unchanged +=
        writes.length - result.upsertedCount - result.modifiedCount;
    }
    batch = [];
    await sleep(PAUSE_MS);
  };

  for await (const doc of cursor) {
    seenIds.add(String(doc._id));
    batch.push(doc);
    if (batch.length >= BATCH_SIZE) {
      await flush();
    }
  }
  await flush();

  // Report copies whose original is gone, without deleting them.
  const copiedIds = await state
    .find({ _id: { $regex: `^${source.target}:` } }, { projection: { _id: 1 } })
    .toArray();
  stats.missingFromOld = copiedIds.filter(
    ({ _id }) => !seenIds.has(_id.slice(source.target.length + 1)),
  ).length;
  stats.read = seenIds.size;
  return stats;
}

async function main() {
  assertSafeTarget();
  // Models (for entities) use the site database through db.js
  await db.initialize();

  const sourceDbs = {};
  for (const dbName of OLD_DATABASES) {
    sourceDbs[dbName] = await mongoose
      .createConnection(mongoUri(dbName), mongoOptions)
      .asPromise();
  }
  const target = await mongoose
    .createConnection(mongoUri(), mongoOptions)
    .asPromise();

  try {
    const unmapped = await findUnmappedCollections(sourceDbs);
    if (unmapped.length > 0) {
      throw new Error(
        `Old collections with no mapping: ${unmapped.join(', ')}. Add them to SOURCES or NOT_COPIED.`,
      );
    }

    console.log(
      `${dryRun ? 'Dry run: reading' : 'Copying'} into "${siteDbName}"`,
    );
    for (const source of SOURCES) {
      const stats = await copyCollection(
        source,
        sourceDbs[source.db].db,
        target.db,
      );
      console.log(
        `${source.db}.${source.collection} -> ${source.target}:`,
        dryRun ? { read: stats.read } : stats,
      );
    }
  } finally {
    await Promise.all([
      target.close(),
      db.connection.close(),
      ...Object.values(sourceDbs).map((conn) => conn.close()),
    ]);
    db.redis.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
