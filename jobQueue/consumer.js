import axios from 'axios';
import { Queue, UnrecoverableError, Worker } from 'bullmq';
import IORedis from 'ioredis';
import auth from '../backend/config/auth.config.js';

import { ARCHIVE_QUEUE } from '../backend/helpers/archiveQueue.js';
import { discoverWebmentionEndpoint } from './discoverWebmentionEndpoint.js';
import { processArchiveUrl } from './processArchiveUrl.js';
import { processSaveWebmention } from './processSaveWebmention.js';
import { processWebmentionDigest } from './processWebmentionDigest.js';
import { makeExternalRequestConfig } from './requestConfig.js';
import { sourceLinksToTarget } from './verifyWebmention.js';

const connection = new IORedis(
  { port: 32856, password: auth.redisPassword },
  { maxRetriesPerRequest: null },
);
const jobQueue = new Queue('jobQueue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

// Daily reminder about webmentions waiting for moderation. Upserting is
// idempotent, so this is safe to run every time the consumer starts.
jobQueue
  .upsertJobScheduler(
    'webmention-digest',
    {
      pattern: auth.webmentionDigestCron || '0 9 * * *',
      tz: auth.webmentionDigestTimezone,
    },
    { name: 'webmention-digest' },
  )
  .catch((err) => {
    console.error('Failed to schedule webmention digest:', err);
  });

const processDiscoverWebMention = async ({ source, target }) => {
  try {
    const webmentionEndpoint = await discoverWebmentionEndpoint(target);
    if (webmentionEndpoint) {
      // If an endpoint exists, add a send job to the queue
      await jobQueue.add('send-webmention', {
        source,
        target,
        webmentionEndpoint,
      });
    }
    return;
  } catch (err) {
    if (err.response) {
      if (err.response.status >= 400 && err.response.status < 500) {
        // Don't retry
        throw new UnrecoverableError(err);
      }
    }
    // Retry on timeout/etc
    throw err;
  }
};

async function processSendWebmention({ source, target, webmentionEndpoint }) {
  try {
    await axios.post(
      webmentionEndpoint,
      { source, target },
      {
        ...makeExternalRequestConfig({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      },
    );
    return;
  } catch (err) {
    if (err.response) {
      if (err.response.status >= 400 && err.response.status < 500) {
        // Don't retry
        throw new UnrecoverableError(err);
      }
    }
    // Retry on timeout/etc
    throw err;
  }
}

async function processReceiveWebmention({ source, target }) {
  try {
    const sourceResp = await axios.get(source, {
      ...makeExternalRequestConfig({
        headers: { Accept: 'text/html, application/json, text/plain' },
      }),
      // Keep the raw body so JSON sources aren't parsed into objects
      responseType: 'text',
    });

    // If the source links to the target, add a job to save the webmention
    if (
      sourceLinksToTarget({
        body: sourceResp.data,
        contentType: sourceResp.headers['content-type'],
        source,
        target,
      })
    ) {
      await jobQueue.add('save-webmention', { source, target });
    } else {
      throw new UnrecoverableError(
        `Webmention source ${source} does not link to target ${target}`,
      );
    }
  } catch (err) {
    if (err.response) {
      if (err.response.status >= 400 && err.response.status < 500) {
        // Don't retry
        throw new UnrecoverableError(err);
      }
    }
    // Retry on timeout/etc
    throw err;
  }
}

new Worker(
  'jobQueue',
  async (job) => {
    switch (job.name) {
      case 'discover-webmention':
        await processDiscoverWebMention(job.data);
        break;
      case 'send-webmention':
        await processSendWebmention(job.data);
        break;
      case 'receive-webmention':
        await processReceiveWebmention(job.data);
        break;
      case 'save-webmention':
        await processSaveWebmention(job.data);
        break;
      case 'webmention-digest':
        return processWebmentionDigest();
    }
  },
  {
    connection,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 1000 },
  },
);

// Archiving links with the Wayback Machine: one at a time, at most one every 15 seconds.
new Worker(ARCHIVE_QUEUE, processArchiveUrl, {
  connection,
  concurrency: 1,
  limiter: { max: 1, duration: 15 * 1000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
});
