import express from 'express';
import mongoose from 'mongoose';

import { FeedEntryMicro } from '../models/feed/feedEntry.model.js';
import MicroEntry from '../models/micro/microEntry.model.js';
import { Tag } from '../models/tag.model.js';

import { authenticated } from './auth.js';

const router = express.Router();

const hasTag = (tagArray, tag) => {
  for (let i = 0; i < tagArray.length; i++) {
    if (tagArray[i].toString() === tag.toString()) {
      return true;
    }
  }
  return false;
};

const updateTagsOnCreate = async (entry) => {
  const tagIds = [];
  if (entry.tags && entry.tags.length) {
    for (let i = 0; i < entry.tags.length; i++) {
      const tag = entry.tags[i];
      let tagRecord;
      if (mongoose.isValidObjectId(tag)) {
        tagRecord = await Tag.findById(tag);
        if (tagRecord) {
          tagRecord.frequency.micro += 1;
          tagRecord.frequency.total += 1;
          const savedTag = await tagRecord.save();
          tagIds.push(savedTag._id);
          continue;
        }
      }
      tagRecord = new Tag({
        value: tag.replace(/[- ]/g, '_').toLowerCase(),
        text: tag.replace(/_/g, ' '),
        frequency: { shortform: 0, blockchain: 0, micro: 1, total: 1 },
      });
      const savedTag = await tagRecord.save();
      tagIds.push(savedTag._id);
    }
  }
  return tagIds;
};

const updateTagsOnEdit = async (oldTags, newTags) => {
  const unchangedTags = newTags.filter((t) => hasTag(oldTags, t));
  const tagsToAdd = newTags.filter((t) => !hasTag(oldTags, t));
  const tagsToRemove = oldTags.filter((t) => !hasTag(newTags, t));
  const addPromise = updateTagsOnCreate({ tags: tagsToAdd });
  const removePromise = Tag.updateMany(
    { _id: { $in: tagsToRemove } },
    { $inc: { 'frequency.micro': -1, 'frequency.total': -1 } },
  );
  const [added] = await Promise.all([addPromise, removePromise]);
  return [...unchangedTags, ...added]; // Don't really care about tag order, we can just mash these together.
};

router.post(
  '/entry',
  authenticated({ redirectTo: '/micro/login' }),
  async function (req, res) {
    try {
      // Update tags (create new ones if necessary, increment usage frequency)
      // Has to happen before the entry is created, or else we don't have the tag IDs to reference
      const tags = await updateTagsOnCreate(req.body);

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
      newEntry.tags = await updateTagsOnEdit(entry.tags, req.body.tags);
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
  const tags = await Tag.find({}, { __v: 0 })
    .collation({ locale: 'en' })
    .sort({ text: 1 })
    .lean();
  res.json(tags);
});

export default router;
