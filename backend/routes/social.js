import express from 'express';

import { getImages, processSocialPost } from '../helpers/social.js';
import { postTweets } from '../helpers/twitter.js';
import { authenticated } from './auth.js';

const router = express.Router();

router.post(
  '/',
  authenticated({ redirectTo: '/micro/login' }),
  async function (req, res) {
    const { twitter, mastodon, bluesky } = req.body;

    // Process posts to proper format
    const socialPosts = {
      twitter: twitter ? processSocialPost(twitter.blocks) : null,
      mastodon: mastodon
        ? processSocialPost(mastodon.blocks, mastodon.tags)
        : null,
      bluesky: bluesky ? processSocialPost(bluesky.blocks) : null,
    };

    const images = await getImages(socialPosts);

    // Make posts
    const tweetId = await postTweets(socialPosts.twitter, images);
    res.json({ tweet: tweetId });
  },
);

export default router;
