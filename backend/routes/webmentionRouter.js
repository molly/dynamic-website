import axios from 'axios';
import { Queue } from 'bullmq';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { mf2 } from 'microformats-parser';
import { makeExternalRequestConfig } from '../../jobQueue/requestConfig.js';
import db from '../models/db.js';
import MicroEntry from '../models/micro/microEntry.model.js';
import { Webmention } from '../models/webmention.model.js';
import logger from '../winston.js';
import { authenticated } from './auth.js';

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
  logger.info('Received webmention', req.body);
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

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

// Manual webmention submission
router.post('/manual', limiter, async (req, res) => {
  if (!req.body || !req.body['source']) {
    res.status(400).json({
      error: 'URL is required.',
    });
    return;
  }
  const url = req.body['source'];
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (err) {
    res.status(400).json({ error: 'URL is invalid.' });
    return;
  }
  if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
    res.status(400).json({
      error: "URL doesn't have a valid protocol (http or https).",
    });
    return;
  }

  const existingWebmention = await Webmention.findOne({ source: url });
  if (existingWebmention) {
    res.status(409).json({ error: 'Webmention with this URL already exists.' });
    return;
  }

  try {
    const webmention = new Webmention({
      source: url,
      target: req.body.target,
      approved: false,
    });
    const webmentionResult = await webmention.save();

    const target = new URL(req.body.target);
    if (target.pathname.startsWith('/micro/entry')) {
      const slug = target.pathname.split('/')[3];
      const relatedEntry = await MicroEntry.findOne({ slug });
      if (relatedEntry) {
        if (!relatedEntry.webmentions) {
          relatedEntry.webmentions = [];
        }
        relatedEntry.webmentions.push(webmentionResult._id);
        await relatedEntry.save();
      }
    }
    res.status(200).send();
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Failed to save webmention.' });
  }
  return;
});

// Admin routes
router.post(
  '/parse',
  authenticated({ redirectTo: '/micro/login' }),
  async (req, res) => {
    if (!req.body || !req.body.id) {
      res.status(400).json({ error: 'Webmention ID is required.' });
      return;
    }
    const webmentionId = req.body.id;
    const webmention = await Webmention.findById(webmentionId);
    if (!webmention) {
      res.status(404).json({ error: 'Webmention not found.' });
      return;
    }
    const { data } = await axios.get(
      webmention.source,
      makeExternalRequestConfig({
        headers: {
          Accept: 'text/html',
        },
      }),
    );
    const baseUrl = new URL(webmention.source).origin;
    const parsed = mf2(data, { baseUrl });
    const hEntry = parsed.items.find((item) => item.type.includes('h-entry'));
    const result = {
      mentionUrl: webmention.source,
    };

    // Author
    result.author = hEntry.properties.author?.[0]?.properties?.name?.[0];
    result.authorUrl = hEntry.properties.author?.[0]?.properties?.url?.[0];
    if (!result.authorUrl) {
      result.authorUrl = parsed.rels?.author?.[0];
    }

    // Date
    result.published = hEntry.properties.published?.[0];

    // Content
    result.content = hEntry.properties.content[0]?.html;
    result.summary = hEntry.properties.summary?.[0];

    // Replies
    if (hEntry.properties['in-reply-to']) {
      const inReplyTo = hEntry.properties['in-reply-to'];
      if (inReplyTo.some((irt) => irt.value === webmention.target)) {
        result.type = 'reply';
      }
    }

    // Likes
    if (hEntry.properties['like-of']) {
      const likeOf = hEntry.properties['like-of'];
      if (likeOf.some((lo) => lo.value === webmention.target)) {
        result.type = 'like';
      }
    }

    // Bookmarks
    if (hEntry.properties['bookmark-of']) {
      const bookmarkOf = hEntry.properties['bookmark-of'];
      if (bookmarkOf.some((bo) => bo === webmention.target)) {
        result.type = 'bookmark';
      }
    }

    // Reposts
    if (hEntry.properties['repost-of']) {
      const repostOf = hEntry.properties['repost-of'];
      if (repostOf.some((ro) => ro.value === webmention.target)) {
        result.type = 'repost';
      }
    }

    res.json(result);
  },
);

router.post(
  '/approve',
  authenticated({ redirectTo: '/micro/login' }),
  async (req, res) => {
    if (!req.body || !req.body.id || !req.body.body) {
      res.status(400).json({ error: 'Webmention ID and body are required.' });
      return;
    }
    const webmentionId = req.body.id;
    const webmention = await Webmention.findById(webmentionId);
    if (!webmention) {
      res.status(404).json({ error: 'Webmention not found.' });
      return;
    }
    for (const key of [
      'author',
      'authorUrl',
      'type',
      'published',
      'content',
      'summary',
    ]) {
      if (req.body.body[key]) {
        if (!webmention.body) {
          webmention.body = {};
        }
        webmention.body[key] = req.body.body[key];
      }
    }
    webmention.approved = true;
    const result = await webmention.save();
    res.json(result);
  },
);

export default router;
