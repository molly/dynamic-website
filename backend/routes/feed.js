import express from 'express';

import { FeedEntryCitationNeeded } from '../models/feed/feedEntry.model.js';
import { authenticated } from './auth.js';

const router = express.Router();

router.post(
  '/citationNeeded',
  authenticated({ redirectTo: '/micro/login' }),
  async (req, res) => {
    try {
      const result = await new FeedEntryCitationNeeded({
        entryType: 'citationNeeded',
        title: req.body.title,
        slug: req.body.slug,
        excerpt: req.body.excerpt,
        image: req.body.image,
      }).save();
      res.json(result);
    } catch (err) {
      console.log(err);
      res.status(500).send({ error: err });
    }
  },
);

export default router;
