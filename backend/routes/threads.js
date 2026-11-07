import express from 'express';
import mongoose from 'mongoose';
import { slugify } from '../helpers/entityKeys.js';
import {
  FEED_ENTRY_LABEL_POPULATE,
  labelFeedEntry,
} from '../helpers/feedEntries.js';
import { listThreads } from '../helpers/threads.js';
import { FeedEntry } from '../models/feed/feedEntry.model.js';
import { Thread } from '../models/thread.model.js';
import logger from '../winston.js';
import { authenticated } from './auth.js';

const router = express.Router();

// All threads with their entry counts, newest first, for the thread picker.
router.get('/', authenticated(), async (req, res) => {
  try {
    res.json(await listThreads());
  } catch (err) {
    logger.error('Failed to list threads', err);
    res.status(500).json({ error: err.message });
  }
});

// Create a thread. The title is optional; untitled threads only drive previous/next links.
router.post('/', authenticated(), async (req, res) => {
  const title = req.body.title?.trim() || undefined;
  try {
    const thread = await new Thread({
      title,
      slug: title ? slugify(title) : undefined,
      description: req.body.description?.trim() || undefined,
    }).save();
    res.status(201).json({ ...thread.toObject(), count: 0 });
  } catch (err) {
    if (err.code === 11000) {
      const existing = await Thread.findOne({ slug: slugify(title) }).lean();
      res
        .status(409)
        .json({ error: 'A thread with that title exists.', existing });
    } else {
      logger.error('Failed to create thread', err);
      res.status(500).json({ error: err.message });
    }
  }
});

// Rename a thread, or add or clear its title and description. Clearing the title makes it an
// untitled thread, which only drives previous/next links.
router.put('/:id', authenticated(), async (req, res) => {
  const title = req.body.title?.trim() || undefined;
  try {
    const thread = await Thread.findById(req.params.id);
    if (!thread) {
      res.sendStatus(404);
      return;
    }
    thread.set({
      title,
      slug: title ? slugify(title) : undefined,
      description: req.body.description?.trim() || undefined,
    });
    await thread.save();
    res.json(thread);
  } catch (err) {
    if (err.code === 11000) {
      res.status(409).json({ error: 'Another thread has that title.' });
    } else {
      logger.error('Failed to update thread', err);
      res.status(500).json({ error: err.message });
    }
  }
});

// The entries just before and after a point in a thread, by createdAt. `at` is the entry's
// createdAt (now, for an entry that hasn't been saved yet); `exclude` is its own feed entry id.
router.get('/:id/neighbors', authenticated(), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      res.status(400).json({ error: 'Invalid thread id.' });
      return;
    }
    const at = req.query.at ? new Date(req.query.at) : new Date();
    if (Number.isNaN(at.getTime())) {
      res.status(400).json({ error: 'Invalid date.' });
      return;
    }
    const filter = { threads: req.params.id, deletedAt: null };
    if (req.query.exclude && mongoose.isValidObjectId(req.query.exclude)) {
      filter._id = { $ne: req.query.exclude };
    }
    const find = (createdAt, sort) =>
      FeedEntry.findOne({ ...filter, createdAt })
        .sort({ createdAt: sort })
        .populate(FEED_ENTRY_LABEL_POPULATE)
        .lean();
    const [previous, next] = await Promise.all([
      find({ $lt: at }, -1),
      find({ $gt: at }, 1),
    ]);
    res.json({
      previous: previous ? labelFeedEntry(previous) : null,
      next: next ? labelFeedEntry(next) : null,
    });
  } catch (err) {
    logger.error('Failed to find thread neighbors', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
