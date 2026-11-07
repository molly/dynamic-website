import express from 'express';
import { linkStatuses, queueArchive } from '../helpers/archive.js';
import { extractUrlsFromBlocks } from '../helpers/links.js';
import logger from '../winston.js';
import { authenticated } from './auth.js';

const router = express.Router();

// The links in a post (as currently written in the editor) and their archive status.
router.post('/links', authenticated(), async (req, res) => {
  try {
    const urls = [
      ...new Set(
        [
          ...extractUrlsFromBlocks(req.body.blocks || [], { embeds: true }),
          ...(req.body.urls || []),
        ].filter((url) => /^https?:\/\//.test(url)),
      ),
    ];
    res.json(await linkStatuses(urls));
  } catch (err) {
    logger.error('Failed to check archive status', err);
    res.status(500).json({ error: err.message });
  }
});

// Queue links for archiving; returns their status.
router.post('/', authenticated(), async (req, res) => {
  try {
    res.json(await queueArchive(req.body.urls || []));
  } catch (err) {
    logger.error('Failed to queue links for archiving', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
