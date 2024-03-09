import axios from 'axios';
import { Queue, UnrecoverableError, Worker } from 'bullmq';
import * as cheerio from 'cheerio';
import IORedis from 'ioredis';

import { discoverWebmentionEndpoint } from './discoverWebmentionEndpoint.js';
import { processSaveWebmention } from './processSaveWebmention.js';
import { makeExternalRequestConfig } from './requestConfig.js';

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
    console.log('hitting source');
    const sourceResp = await axios.get(source, {
      ...makeExternalRequestConfig({
        headers: { Accept: 'text/html, application/json, text/plain' },
      }),
    });
    console.log('resp', sourceResp.headers['content-type']);
    console.log('resp', sourceResp.data);

    // If the source links to the target, add a job to save the webmention
    if (sourceResp.headers['content-type'].includes('text/html')) {
      const $ = cheerio.load(sourceResp.data);
      const links = $(
        `a[href="${target.href}"], img[src="${target.href}"], video[src="${target.href}"]`,
      );
      if (links) {
        await jobQueue.add('save-webmention', { source, target });
      }
      return;
    } else if (
      (sourceResp.headers['content-type'].includes('application/json') &&
        new RegExp(`["']${target.href}["']`).test(sourceResp.data)) ||
      (sourceResp.headers['content-type'].includes('text/plain') &&
        sourceResp.data.includes(target.href))
    ) {
      console.log('saving', { source, target });
      await jobQueue.add('save-webmention', { source, target });
    }
  } catch (err) {
    console.log(err);
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
    console.log(job.name);
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
    }
  },
  {
    connection,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 1000 },
  },
);
