import { BlockchainTag, PressTag, ShortformTag } from '../models/tag.model.js';
import BlockchainEntry from '../models/blockchainEntry.model.js';
import PressEntry from '../models/pressEntry.model.js';
import ShortformEntry from '../models/shortformEntry.model.js';
import sortBy from 'lodash.sortby';
import { verifyJwt } from '../middlewares/jwt.js';
import express from 'express';
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
    blockchain: await getCollectionTags(BlockchainTag),
    press: await getCollectionTags(PressTag),
    shortform: await getCollectionTags(ShortformTag),
  };
  res.send(tags);
});

router.post('/entry', verifyJwt, async (req, res) => {
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
