import { Tag } from '../models/tag.model.js';

export const updateTags = async (entry, entryType) => {
  if (entry.tags && entry.tags.length) {
    for (const tag of entry.tags) {
      let tagRecord = await Tag.findOne({ value: tag });
      if (tagRecord) {
        tagRecord.frequency += 1;
      } else {
        const frequency = { shortform: 0, blockchain: 0, micro: 0, total: 1 };
        frequency[entryType] = 1;
        tagRecord = new Tag({
          value: tag.replace(/[- ]/g, '_').toLowerCase(),
          text: tag.replace(/_/g, ' '),
          frequency,
        });
      }
      await tagRecord.save();
    }
  }
};
