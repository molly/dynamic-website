import express from 'express';

import { validateGhostWebhook } from '../helpers/ghostAuth.js';
import { FeedEntryCitationNeeded } from '../models/feed/feedEntry.model.js';

const router = express.Router();

router.post('/citationNeeded', validateGhostWebhook, async (req, res) => {
  try {
    const { post } = req.body;
    const result = await new FeedEntryCitationNeeded({
      entryType: 'citationNeeded',
      title: post.current.title,
      slug: post.current.slug,
      excerpt: `<p>${post.current.excerpt}</p>`,
      image: post.current.feature_image,
      imageAlt: post.current.feature_image_alt,
    }).save();
    res.json(result);
  } catch (err) {
    console.log(err);
    res.status(500).send({ error: err });
  }
});

export default router;
