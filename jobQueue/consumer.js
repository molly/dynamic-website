import axios from 'axios';
import { Queue, UnrecoverableError, Worker } from 'bullmq';
import IORedis from 'ioredis';

import discoverWebmentionEndpoint from './discoverWebmentionEndpoint.js';
import { WEBMENTION_USER_AGENT } from './useragents.js';

const connection = new IORedis(32856, { maxRetriesPerRequest: null });
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
        'User-Agent': WEBMENTION_USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
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
    }
  },
  {
    connection,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 1000 },
  },
);
