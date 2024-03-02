import express from 'express';
import mongoose from 'mongoose';

import { updateTagsOnCreate, updateTagsOnEdit } from '../helpers/tags.js';
import { FeedEntryMicro } from '../models/feed/feedEntry.model.js';
import MicroEntry from '../models/micro/microEntry.model.js';
import { Tag } from '../models/tag.model.js';
import { authenticated } from './auth.js';

const router = express.Router();

router.post(
  '/entry',
  authenticated({ redirectTo: '/micro/login' }),
  async function (req, res) {
    try {
      // Update tags (create new ones if necessary, increment usage frequency)
      // Has to happen before the entry is created, or else we don't have the tag IDs to reference
      const tags = await updateTagsOnCreate(req.body.tags, 'micro');

      // Make entry
      const microEntryId = new mongoose.Types.ObjectId();
      const entryPromise = new MicroEntry({
        ...req.body,
        tags,
        _id: microEntryId,
      }).save();

      // Add entry to feed
      const feedEntryPromise = new FeedEntryMicro({
        type: 'micro',
        micro: microEntryId,
      }).save();

      const [entryResult] = await Promise.all([entryPromise, feedEntryPromise]);
      res.json(entryResult);
    } catch (err) {
      console.log(err);
      res.status(500).send({ error: err });
    }
  },
);

router.post(
  '/entry/:id',
  authenticated({ redirectTo: '/micro/login' }),
  async function (req, res) {
    try {
      const entry = await MicroEntry.findById(req.params.id);
      const newEntry = req.body;
      newEntry.tags = await updateTagsOnEdit(
        entry.tags,
        req.body.tags,
        'micro',
      );
      if (!entry) {
        res.sendStatus(404);
        return;
      }
      Object.keys(newEntry)
        .filter(
          (key) => !['_id', 'createdAt', 'updatedAt', '__v'].includes(key),
        )
        .forEach((key) => {
          if (entry[key] !== newEntry[key]) {
            entry[key] = newEntry[key];
          }
        });
      const entryResult = await entry.save();
      res.json(entryResult);
    } catch (err) {
      console.log(err);
      res.status(500).send({ error: err });
    }
  },
);

router.get('/entry/:slug', async (req, res) => {
  const entry = await MicroEntry.findOne({ slug: req.params.slug });
  if (entry) {
    res.json(entry);
  } else {
    res.sendStatus(404);
  }
});

router.get('/tags', async (_, res) => {
  const tags = await Tag.find({}, { __v: 0 }).sort({ value: 1 }).lean();
  res.json(tags);
});

export default router;
