import express from 'express';
import sortBy from 'lodash.sortby';
import {
  BlockchainEntry,
  PressEntry,
  ShortformEntry,
} from '../models/entry.model.js';
import { BlockchainTag, PressTag, ShortformTag } from '../models/tag.model.js';
import { authenticated } from './auth.js';

const router = express.Router();

const models = {
  blockchain: BlockchainEntry,
  press: PressEntry,
  shortform: ShortformEntry,
};

const tagModels = {
  blockchain: BlockchainTag,
  press: PressTag,
  shortform: ShortformTag,
};

const updateTags = async (type, entry) => {
  if (entry.tags && entry.tags.length) {
    const TagModel = tagModels[type];
    for (const tag of entry.tags) {
      let tagRecord = await TagModel.findOne({ value: tag });
      if (tagRecord) {
        tagRecord.frequency += 1;
      } else {
        tagRecord = new TagModel({
          value: tag.replace(/[- ]/g, '_'),
          text: tag.replace(/_/g, ' '),
          frequency: 1,
        });
      }
      await tagRecord.save();
    }
  }
};

const getCollectionTags = async (model) => {
  const tags = await model.find({}, '-_id');
  return sortBy(tags, (t) => t.text.toLowerCase());
};

router.get('/tags', async (_, res) => {
  const tags = {
    blockchain: await getCollectionTags(tagModels.blockchain),
    press: await getCollectionTags(tagModels.press),
    shortform: await getCollectionTags(tagModels.shortform),
  };
  res.send(tags);
});

router.post('/entry', authenticated, async (req, res) => {
  const { type, entry } = req.body;
  const model = new models[type](entry);
  try {
    await model.save();
    await updateTags(type, entry);
    return res.status(204).send();
  } catch (err) {
    return res.status(400).send({ message: err });
  }
});

export default router;
