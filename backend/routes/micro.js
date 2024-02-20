import express from 'express';
import mongoose from 'mongoose';
import { FeedEntryMicro } from '../models/feed/feedEntry.model.js';
import MicroEntry from '../models/micro/microEntry.model.js';
import { authenticated } from './auth.js';
const router = express.Router();

router.post(
  '/entry',
  authenticated({ redirectTo: '/micro/login' }),
  async function (req, res) {
    try {
      const microEntryId = new mongoose.Types.ObjectId();
      const result = await new MicroEntry({
        ...req.body,
        _id: microEntryId,
      }).save();
      await new FeedEntryMicro({ type: 'micro', micro: microEntryId }).save();
      res.json(result);
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
      if (!entry) {
        res.sendStatus(404);
        return;
      }
      Object.keys(req.body)
        .filter(
          (key) => !['_id', 'createdAt', 'updatedAt', '__v'].includes(key),
        )
        .forEach((key) => {
          if (entry[key] !== req.body[key]) {
            entry[key] = req.body[key];
          }
        });
      const result = await entry.save();
      res.json(result);
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

export default router;
