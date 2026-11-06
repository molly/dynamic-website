import axios from 'axios';
import { Queue } from 'bullmq';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import mongoose from 'mongoose';
import { makeExternalRequestConfig } from '../../jobQueue/requestConfig.js';
import { parseWebmentionSource } from '../helpers/parseWebmention.js';
import db from '../models/db.js';
import MicroEntry from '../models/micro/microEntry.model.js';
import { Webmention } from '../models/webmention.model.js';
import logger from '../winston.js';
import { authenticated } from './auth.js';

const router = express.Router();

// Pages are served from www.mollywhite.net, so that's what nearly all targets
// will use; accept the bare domain too.
const ACCEPTED_TARGET_HOSTNAMES = ['www.mollywhite.net', 'mollywhite.net'];

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
  if (
    process.argv[2] === 'prod' &&
    !ACCEPTED_TARGET_HOSTNAMES.includes(target.hostname)
  ) {
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
const BODY_FIELDS = [
  'author',
  'authorUrl',
  'type',
  'published',
  'content',
  'summary',
];

// Fetch a webmention's source page and extract display details from it.
// Throws if the source can't be fetched.
const fetchAndParse = async (webmention) => {
  let html;
  try {
    ({ data: html } = await axios.get(webmention.source, {
      ...makeExternalRequestConfig({
        headers: {
          Accept: 'text/html',
        },
      }),
      responseType: 'text',
    }));
  } catch (err) {
    throw new Error(`Couldn't fetch source: ${err.message}`);
  }
  return parseWebmentionSource({
    html,
    source: webmention.source,
    target: webmention.target,
  });
};

const approve = (webmention, body) => {
  webmention.body = webmention.body || {};
  for (const key of BODY_FIELDS) {
    if (body[key]) {
      webmention.body[key] = body[key];
    }
  }
  webmention.approved = true;
  webmention.rejectedAt = undefined;
  return webmention.save();
};

const validIds = (ids) =>
  Array.isArray(ids) &&
  ids.length > 0 &&
  ids.every((id) => mongoose.isValidObjectId(id));

router.post(
  '/parse',
  authenticated({ redirectTo: '/micro/login' }),
  async (req, res) => {
    if (!req.body || !req.body.id) {
      res.status(400).json({ error: 'Webmention ID is required.' });
      return;
    }
    const webmention = await Webmention.findById(req.body.id);
    if (!webmention) {
      res.status(404).json({ error: 'Webmention not found.' });
      return;
    }
    try {
      res.json(await fetchAndParse(webmention));
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
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
    const webmention = await Webmention.findById(req.body.id);
    if (!webmention) {
      res.status(404).json({ error: 'Webmention not found.' });
      return;
    }
    res.json(await approve(webmention, req.body.body));
  },
);

// Parse and approve several webmentions at once. Any that can't be fetched or
// don't have an h-entry are left pending for manual review.
router.post(
  '/approve-bulk',
  authenticated({ redirectTo: '/micro/login' }),
  async (req, res) => {
    if (!req.body || !validIds(req.body.ids)) {
      res.status(400).json({ error: 'A list of webmention IDs is required.' });
      return;
    }
    const webmentions = await Webmention.find({
      _id: { $in: req.body.ids },
      approved: false,
      rejectedAt: null,
    });
    const found = new Set(webmentions.map((w) => w._id.toString()));
    const approved = [];
    const skipped = req.body.ids
      .filter((id) => !found.has(id))
      .map((id) => ({ id, reason: 'Not found or no longer pending.' }));

    await Promise.all(
      webmentions.map(async (webmention) => {
        const id = webmention._id.toString();
        try {
          const parsed = await fetchAndParse(webmention);
          if (parsed.warning) {
            skipped.push({ id, reason: parsed.warning });
            return;
          }
          await approve(webmention, parsed);
          approved.push(id);
        } catch (err) {
          skipped.push({ id, reason: err.message });
        }
      }),
    );
    res.json({ approved, skipped });
  },
);

router.post(
  '/reject',
  authenticated({ redirectTo: '/micro/login' }),
  async (req, res) => {
    if (!req.body || !validIds(req.body.ids)) {
      res.status(400).json({ error: 'A list of webmention IDs is required.' });
      return;
    }
    // Keep the records (rather than deleting them) so that if a source re-sends
    // a webmention, the existing record causes it to be ignored. The TTL index
    // on rejectedAt removes them later.
    const { matchedCount } = await Webmention.updateMany(
      { _id: { $in: req.body.ids } },
      { $set: { approved: false, rejectedAt: new Date() } },
    );
    if (matchedCount === 0) {
      res.status(404).json({ error: 'Webmentions not found.' });
      return;
    }
    await MicroEntry.updateMany(
      { webmentions: { $in: req.body.ids } },
      { $pull: { webmentions: { $in: req.body.ids } } },
    );
    res.sendStatus(204);
  },
);

export default router;
