import { Queue } from 'bullmq';
import disallowList from '../config/webmentionDisallow.js';
import { isProd } from '../env.js';
import { entryBlocks, entryPosts, extractUrlsFromBlocks } from './links.js';
import { mentionedWebsites } from './mentions.js';
import db from '../models/db.js';
import MicroEntry from '../models/micro/microEntry.model.js';

const webmentionTargets = (entry) =>
  [...extractUrlsFromBlocks(entryBlocks(entry)), entry.inReplyTo?.url].filter(
    Boolean,
  );

// On save, queue jobs to send webmentions to all URLs in previous and new version of post
export const sendWebmentions = async (doc) => {
  if (!isProd) {
    // Outside prod, posts point at a dev copy of the site; don't notify other sites about them.
    return;
  }
  const old = await MicroEntry.findById(doc._id).lean();
  // What webmentions are sent about: links in the post and its updates, and the post it replies to.
  const linked = (entry) => ({
    blocks: entryBlocks(entry),
    inReplyTo: entry.inReplyTo?.url || null,
  });
  if (
    old &&
    !doc.deletedAt &&
    JSON.stringify(linked(old)) === JSON.stringify(linked(doc.toObject()))
  ) {
    return; // Nothing webmentions depend on has changed
  }

  let urls = [];
  const source = 'https://www.mollywhite.net/micro/entry/' + doc.slug;

  if (!doc.deletedAt) {
    // Extract URLs from new version of post (if there is one -- deleted posts don't have this)
    urls = webmentionTargets(doc.toObject());
  }
  if (old) {
    // Also get all URLs from the old version of the post, if this is an update
    urls = urls.concat(webmentionTargets(old));
  }
  // Mentioned entities' websites get webmentions too. (Old-format mentions had the link in the
  // post itself, so it's found above.)
  urls = urls.concat(
    await mentionedWebsites([
      ...(doc.deletedAt ? [] : entryPosts(doc.toObject())),
      ...(old ? entryPosts(old) : []),
    ]),
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
