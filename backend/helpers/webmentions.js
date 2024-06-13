import { Queue } from 'bullmq';
import * as cheerio from 'cheerio';
import disallowList from '../config/webmentionDisallow.js';
import db from '../models/db.js';
import MicroEntry from '../models/micro/microEntry.model.js';

// Extract all URLs from a block of text
const extractUrlsFromText = (text) => {
  if (text.includes('cdx-mention')) {
    // Use heavier processing if mentions are used
    const links = [];
    const $ = cheerio.load(text, null, false);
    for (let link of $('a')) {
      const $link = $(link);
      if (!$link.data('username') && $link.attr('href').startsWith('http')) {
        links.push($link.attr('href'));
      }
    }
    return links;
  } else {
    // Otherwise a simple regex should suffice
    const matches = text.matchAll(/<a.*?href=['"](http.*?)["']/g);
    return Array.from(matches).map((match) => match[1]);
  }
};

// Extracts URLs from a list of blocks that may or may not contain links
const extractUrlsFromBlocks = (blocks) => {
  const urls = [];
  for (let block of blocks) {
    if (block.type === 'paragraph') {
      const text = block.data.text;
      urls.push(...extractUrlsFromText(text));
    } else if (block.type === 'list') {
      for (let item of block.data.items) {
        urls.push(...extractUrlsFromText(item));
      }
    } else if (block.type === 'image') {
      urls.push(...extractUrlsFromText(block.data.caption));
    } else if (block.type === 'raw') {
      urls.push(...extractUrlsFromText(block.data.html));
    }
  }
  return urls;
};

// On save, queue jobs to send webmentions to all URLs in previous and new version of post
export const sendWebmentions = async (doc) => {
  const changes = doc.getChanges();
  const old = await MicroEntry.findById(doc._id).lean();
  if (
    changes['$set'] &&
    Object.keys(changes['$set']).length === 2 &&
    changes['$set'].updatedAt &&
    changes['$set'].post
  ) {
    if (
      old &&
      JSON.stringify(old.post.blocks) ===
        JSON.stringify(changes['$set'].post.blocks)
    ) {
      // No changes to post, so no need to send webmentions
      return;
    }
  }

  let urls = [];
  const source = 'https://www.mollywhite.net/micro/' + doc.slug;

  if (!doc.deletedAt) {
    // Extract URLs from new version of post (if there is one -- deleted posts don't have this)
    urls = extractUrlsFromBlocks(doc.post.blocks);
  }
  if (old) {
    // Also get all URLs from the old version of the post, if this is an update
    urls = urls.concat(extractUrlsFromBlocks(old.post.blocks));
  }

  // Dedupe
  urls = new Set(urls);
  if (urls.size > 0) {
    const jobQueue = new Queue('jobQueue', {
      connection: db.redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    });

    for (let url of urls) {
      const domain = new URL(url).hostname;
      if (disallowList.some((disallowed) => domain.endsWith(disallowed))) {
        // Skip links on disallowlist
        continue;
      }

      // Queue webmentions
      await jobQueue.add('discover-webmention', {
        source,
        target: url,
      });
    }
  }
};
