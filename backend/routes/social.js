import express from 'express';

import { processSocialPost } from '../helpers/social.js';
import { authenticated } from './auth.js';

const router = express.Router();

router.post(
  '/',
  authenticated({ redirectTo: '/micro/login' }),
  function (req, res) {
    const { twitter, mastodon, bluesky } = req.body;
    const socialPosts = {
      twitter: twitter ? processSocialPost(twitter.blocks) : null,
      mastodon: mastodon
        ? processSocialPost(mastodon.blocks, mastodon.tags)
        : null,
      bluesky: bluesky ? processSocialPost(bluesky.blocks) : null,
    };
    res.json(socialPosts);
  },
);

export default router;
