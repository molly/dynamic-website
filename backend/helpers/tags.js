import mongoose from 'mongoose';
import { BookTag, Tag } from '../models/tag.model.js';

const hasTag = (tagArray, tag) => {
  for (let i = 0; i < tagArray.length; i++) {
    if (tagArray[i].toString() === tag.toString()) {
      return true;
    }
  }
  return false;
};

export const updateTagsOnCreate = async (tags, category, isBook = false) => {
  const tagIds = [];
  const tagModel = isBook ? BookTag : Tag;
  if (tags && tags.length) {
    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i];
      let tagRecord;
      if (mongoose.isValidObjectId(tag)) {
        tagRecord = await tagModel.findById(tag);
        if (tagRecord) {
          if (!isBook) {
            tagRecord.frequency[category] += 1;
          }
          tagRecord.frequency.total += 1;
          const savedTag = await tagRecord.save();
          tagIds.push(savedTag._id);
          continue;
        }
      }
      let frequency = {
        total: 1,
      };
      if (!isBook) {
        frequency = {
          shortform: 0,
          micro: 0,
          citationNeeded: 0,
          total: 1,
        };
      }
      frequency[category] = 1;
      tagRecord = new tagModel({
        value: tag.replace(/[- ]/g, '_').toLowerCase(),
        text: tag.replace(/_/g, ' '),
        frequency,
      });
      const savedTag = await tagRecord.save();
      tagIds.push(savedTag._id);
    }
  }
  return tagIds;
};

export const updateTagsOnEdit = async (
  oldTags,
  newTags,
  category,
  isBook = false,
) => {
  const tagModel = isBook ? BookTag : Tag;
  const unchangedTags = newTags.filter((t) => hasTag(oldTags, t));
  const tagsToAdd = newTags.filter((t) => !hasTag(oldTags, t));
  const tagsToRemove = oldTags.filter((t) => !hasTag(newTags, t));
  const addPromise = updateTagsOnCreate(tagsToAdd, category, isBook);
  const updateFields = { 'frequency.total': -1 };
  if (!isBook) {
    updateFields[`frequency.${category}`] = -1;
  }
  const removePromise = tagModel.updateMany(
    { _id: { $in: tagsToRemove } },
    { $inc: updateFields },
  );
  const [added] = await Promise.all([addPromise, removePromise]);
  return [...unchangedTags, ...added]; // Don't really care about tag order, we can just mash these together.
};
