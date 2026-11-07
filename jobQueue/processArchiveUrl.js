import mongoose from 'mongoose';
import {
  ARCHIVED_LINK_COLLECTION,
  ArchivedLinkSchema,
} from '../backend/models/archivedLink.schema.js';
import { mongoOptions, mongoUri } from '../backend/models/mongoUri.js';
import { findRecentCapture, savePageNow } from './wayback.js';

/**
 * Archive one URL: use a recent Wayback Machine capture if there is one, otherwise save a new
 * one. Failures are retried by the queue; after the last attempt the link is marked failed.
 * @param {import('bullmq').Job} job
 */
export async function processArchiveUrl(job) {
  const { url } = job.data;
  const connection = mongoose.createConnection(mongoUri(), mongoOptions);
  const ArchivedLink = connection.model(
    'ArchivedLink',
    ArchivedLinkSchema,
    ARCHIVED_LINK_COLLECTION,
  );
  try {
    const capture = (await findRecentCapture(url)) || (await savePageNow(url));
    await ArchivedLink.updateOne(
      { url },
      {
        $set: { ...capture, status: 'ok', lastCheckedAt: new Date() },
        $unset: { error: '' },
      },
      { upsert: true },
    );
    return capture;
  } catch (err) {
    const lastAttempt = job.attemptsMade + 1 >= (job.opts.attempts || 1);
    await ArchivedLink.updateOne(
      { url },
      {
        $set: {
          lastCheckedAt: new Date(),
          error: err.response
            ? `${err.response.status} from the Wayback Machine`
            : err.message,
          ...(lastAttempt ? { status: 'failed' } : {}),
        },
      },
      { upsert: true },
    );
    throw err;
  } finally {
    await connection.close();
  }
}
