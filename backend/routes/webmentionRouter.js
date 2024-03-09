import { Queue } from 'bullmq';
import express from 'express';
import db from '../models/db.js';

const router = express.Router();

router.use(express.json());
router.use(express.urlencoded({ extended: true }));

router.post('/', async (req, res) => {
  if (!req.body || !req.body['source'] || !req.body['target']) {
    res.status(400).json({
      error: 'Webmention requests should have a source and a target.',
    });
    return;
  }
  // Let's be reasonable, now.
  if (req.body['source'].length > 2048 || req.body['target'].length > 2048) {
    res.status(400).json({
      error: 'Source and target URLs should be less than 2048 characters.',
    });
    return;
  }

  let source;
  let target;
  try {
    source = new URL(req.body['source']);
    target = new URL(req.body['target']);
  } catch (err) {
    res.status(400).json({ error: 'Source or target URL is invalid.' });
    return;
  }

  if (!['https:', 'http:'].includes(source.protocol)) {
    res.status(400).json({
      error: 'Source URL should have a valid protocol (http or https).',
    });
    return;
  }
  if (!['https:', 'http:'].includes(target.protocol)) {
    res.status(400).json({
      error: 'Target URL should have a valid protocol (http or https).',
    });
    return;
  }
  if (source.href.localeCompare(target.href, 'en') === 0) {
    res
      .status(400)
      .json({ error: 'Source and target URLs should not be the same.' });
    return;
  }
  if (process.argv[2] === 'prod' && target.hostname !== 'mollywhite.net') {
    res.status(400).json({ error: 'Target URL should be on mollywhite.net.' });
    return;
  }

  // Initial validation passed, add this to the queue for processing and send 202
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
  await jobQueue.add('receive-webmention', {
    source: source.href,
    target: target.href,
  });

  res.sendStatus(202);
});

export default router;
