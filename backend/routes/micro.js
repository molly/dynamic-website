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

export default router;
