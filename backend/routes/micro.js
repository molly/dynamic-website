import express from 'express';
import mongoose from 'mongoose';

import { updateTagsOnCreate, updateTagsOnEdit } from '../helpers/tags.js';
import { ShortformEntry } from '../models/entry.model.js';
import { FeedEntryMicro } from '../models/feed/feedEntry.model.js';
import MicroEntry from '../models/micro/microEntry.model.js';
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

// Get related posts for dropdown
router.get('/relatedPosts', async (req, res) => {
  const results = await ShortformEntry.aggregate([
    { $sort: { entryAdded: -1 } },
    { $limit: 10 },
    {
      $project: {
        sortBy: '$entryAdded',
        title: 1,
        _id: 1,
        type: 'ShortformEntry',
      },
    },
    {
      $unionWith: {
        coll: 'blockchain',
        pipeline: [
          { $sort: { entryAdded: -1 } },
          { $limit: 10 },
          {
            $project: {
              sortBy: '$entryAdded',
              title: 1,
              _id: 1,
              type: 'BlockchainEntry',
            },
          },
        ],
      },
    },
    {
      $unionWith: {
        coll: 'press',
        pipeline: [
          { $sort: { date: -1 } },
          { $limit: 5 },
          {
            $project: { sortBy: '$date', title: 1, _id: 1, type: 'PressEntry' },
          },
        ],
      },
    },
    { $sort: { sortBy: -1 } },
  ]);
  res.json(results);
});

export default router;
