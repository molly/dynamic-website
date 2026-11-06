import express from 'express';

import { getImages, processSocialPost } from '../helpers/social.js';
import logger from '../winston.js';
import { authenticated } from './auth.js';

import { postSkeets } from '../helpers/bluesky.js';
import { postToots } from '../helpers/mastodon.js';

const router = express.Router();

// Twitter isn't posted from here: the X API now requires paid access, so the editor sends Twitter
// posts to the local helper in backend/scripts/xComposeHelper.js instead.
const POSTERS = {
  mastodon: postToots,
  bluesky: postSkeets,
};

router.post('/', authenticated(), async function (req, res) {
  try {
    // Process posts to proper format
    const socialPosts = {};
    for (const network of Object.keys(POSTERS)) {
      const content = req.body[network];
      socialPosts[network] = content
        ? processSocialPost(
            content.blocks,
            network,
            network === 'mastodon' ? content.tags : undefined,
          )
        : null;
    }

    const images = await getImages(socialPosts);

    // Make posts. Each network succeeds or fails independently, so one failure doesn't hide
    // the IDs of posts that were successfully made on the other networks.
    const networks = Object.keys(POSTERS).filter((n) => socialPosts[n]);
    const results = await Promise.allSettled(
      networks.map((n) => POSTERS[n](socialPosts[n], images)),
    );

    const postIds = {};
    const errors = {};
    results.forEach((result, i) => {
      const network = networks[i];
      if (result.status === 'fulfilled') {
        postIds[network] = result.value;
      } else {
        logger.error(`Failed to post to ${network}`, result.reason);
        errors[network] = result.reason?.message || String(result.reason);
      }
    });

    res.json({ postIds, errors });
  } catch (err) {
    logger.error('Failed to prepare social posts', err);
    res.status(500).send({ error: err.message || String(err) });
  }
});

export default router;
