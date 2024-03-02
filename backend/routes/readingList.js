import express from 'express';
import { updateTagsOnCreate } from '../helpers/tags.js';
import {
  BlockchainEntry,
  PressEntry,
  ShortformEntry,
} from '../models/entry.model.js';
import { FeedEntryReading } from '../models/feed/feedEntry.model.js';
import { Tag } from '../models/tag.model.js';
import { authenticated } from './auth.js';

const router = express.Router();

const models = {
  blockchain: BlockchainEntry,
  press: PressEntry,
  shortform: ShortformEntry,
};

router.get('/tags', async (_, res) => {
  const tags = await Tag.find({}, { __v: 0 }).lean();
  res.send(tags);
});

router.post('/entry', authenticated(), async (req, res) => {
  const { type, entry } = req.body;
  const model = new models[type](entry);
  try {
    const result = await model.save();
    await updateTagsOnCreate(entry.tags, type);

    // Add to activity feed
    if (type === 'shortform' || type === 'blockchain') {
      await new FeedEntryReading({
        reading: result._id,
        readingModel: models[type].modelName,
      }).save();
    }
    return res.status(204).send();
  } catch (err) {
    return res.status(400).send({ message: err });
  }
});

export default router;
