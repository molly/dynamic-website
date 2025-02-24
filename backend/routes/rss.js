import express from 'express';
import {
  generateRssForFeed,
  generateRssForMicro,
  generateRssForReading,
} from '../helpers/rss.js';
import { authenticated } from './auth.js';

const router = express.Router();

// Most builds should happen automatically as the DB is updated, but this function
// can kick off a manual build if need be.
router.post('/build', authenticated(), (req, res) => {
  const { feed } = req.body;
  if (!feed) {
    return res.status(400).send({ message: 'Feed not provided' });
  } else if (['reading', 'micro', 'feed', 'all'].indexOf(feed) === -1) {
    return res.status(400).send({ message: 'Invalid feed type' });
  }

  // Just kick off the build; this will happen async
  switch (feed) {
    case 'reading':
      generateRssForReading();
      break;
    case 'micro':
      generateRssForMicro();
      break;
    case 'feed':
      generateRssForFeed();
      break;
    case 'all':
      generateRssForReading();
      generateRssForMicro();
      generateRssForFeed();
      break;
  }

  res.status(200).send({ message: 'RSS build started' });
});

export default router;
