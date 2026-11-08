import { Queue } from 'bullmq';
import { ArchivedLink } from '../models/archivedLink.model.js';
import db from '../models/db.js';
import { waybackFileUrl } from '../../jobQueue/wayback.js';
import { ARCHIVE_QUEUE } from './archiveQueue.js';

// Archiving links with the Wayback Machine. Jobs run in jobQueue/consumer.js on their own queue,
// rate-limited so the Wayback Machine isn't hammered and webmentions aren't held up.

let queue;
function archiveQueue() {
  if (!queue) {
    queue = new Queue(ARCHIVE_QUEUE, {
      connection: db.redis,
      defaultJobOptions: {
        attempts: 4,
        backoff: { type: 'exponential', delay: 60 * 1000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    });
  }
  return queue;
}

const isWebUrl = (url) => /^https?:\/\//.test(url);

/**
 * Archive status for each URL: none (never archived), queued, ok or failed.
 * @param {string[]} urls
 */
export async function linkStatuses(urls) {
  const records = await ArchivedLink.find({ url: { $in: urls } }).lean();
  const byUrl = new Map(records.map((record) => [record.url, record]));
  return urls.map((url) => {
    const record = byUrl.get(url);
    return {
      url,
      status: record?.status || 'none',
      archiveUrl: record?.archiveUrl,
      archivedAt: record?.archivedAt,
      error: record?.error,
    };
  });
}

/**
 * Queue URLs for archiving. Links already archived or already queued are left alone.
 * @param {string[]} urls
 * @param {{delay?: number}} [options] delay: milliseconds before the job may run
 */
export async function queueArchive(urls, { delay = 0 } = {}) {
  const valid = [...new Set(urls.filter(isWebUrl))];
  for (const { url, status } of await linkStatuses(valid)) {
    if (status === 'ok' || status === 'queued') {
      continue;
    }
    await ArchivedLink.updateOne(
      { url },
      { $set: { status: 'queued' }, $unset: { error: '' } },
      { upsert: true },
    );
    await archiveQueue().add('archive-url', { url }, { delay });
  }
  return linkStatuses(valid);
}

/**
 * The Wayback Machine's copy of a URL as the file it saved, if the URL has been archived.
 * @param {string} url
 * @returns {Promise<?string>}
 */
export async function archivedFileUrl(url) {
  const record = await ArchivedLink.findOne({ url, status: 'ok' }).lean();
  return record?.archiveUrl ? waybackFileUrl(record.archiveUrl) : null;
}
