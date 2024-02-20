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
      await new MicroEntry({
        ...req.body,
        _id: microEntryId,
      }).save();
      await new FeedEntryMicro({ type: 'micro', micro: microEntryId }).save();
      res.sendStatus(200);
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
      const result = await MicroEntry.findByIdAndUpdate(
        req.params.id,
        req.body,
      );
      console.log(result);
      res.sendStatus(200);
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
