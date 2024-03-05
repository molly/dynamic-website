import express from 'express';

import { getImages, processSocialPost } from '../helpers/social.js';
import { authenticated } from './auth.js';

import { postSkeets } from '../helpers/bluesky.js';
import { postToots } from '../helpers/mastodon.js';
import { postTweets } from '../helpers/twitter.js';

const router = express.Router();

router.post(
  '/',
  authenticated({ redirectTo: '/micro/login' }),
  async function (req, res) {
    const { twitter, mastodon, bluesky } = req.body;

    // Process posts to proper format
    const socialPosts = {
      twitter: twitter ? processSocialPost(twitter.blocks, 'twitter') : null,
      mastodon: mastodon
        ? processSocialPost(mastodon.blocks, 'mastodon', mastodon.tags)
        : null,
      bluesky: bluesky ? processSocialPost(bluesky.blocks, 'bluesky') : null,
    };

    const images = await getImages(socialPosts);

    // Make posts
    const promises = [
      postTweets(socialPosts.twitter, images),
      postToots(socialPosts.mastodon, images),
      postSkeets(socialPosts.bluesky, images),
    ];
    const [tweetId, tootId, skeetId] = await Promise.all(promises);
    res.json({ twitter: tweetId, mastodon: tootId, bluesky: skeetId });
  },
);

export default router;
