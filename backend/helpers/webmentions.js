import { Queue } from 'bullmq';
import disallowList from '../config/webmentionDisallow.js';
import { isProd } from '../env.js';
import { extractUrlsFromBlocks } from './links.js';
import { mentionedWebsites } from './mentions.js';
import db from '../models/db.js';
import MicroEntry from '../models/micro/microEntry.model.js';

// On save, queue jobs to send webmentions to all URLs in previous and new version of post
export const sendWebmentions = async (doc) => {
  if (!isProd) {
    // Outside prod, posts point at a dev copy of the site; don't notify other sites about them.
    return;
  }
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
  const source = 'https://www.mollywhite.net/micro/entry/' + doc.slug;

  if (!doc.deletedAt) {
    // Extract URLs from new version of post (if there is one -- deleted posts don't have this)
    urls = extractUrlsFromBlocks(doc.post.blocks);
  }
  if (old) {
    // Also get all URLs from the old version of the post, if this is an update
    urls = urls.concat(extractUrlsFromBlocks(old.post.blocks));
  }
  // Mentioned entities' websites get webmentions too. (Old-format mentions had the link in the
  // post itself, so it's found above.)
  urls = urls.concat(
    await mentionedWebsites(
      [doc.deletedAt ? null : doc.post, old?.post].filter(Boolean),
    ),
  );

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
