import EditorJSHtml from 'editorjs-html';
import MicroEntry from '../backend/models/micro/microEntry.model.js';
import { formatMedia } from './helpers/media.js';
import { hydrateAndSortSocialLinks } from './helpers/socialMedia.js';
import { hydrateTimestamps } from './helpers/timestamps.js';

const edjsParser = EditorJSHtml({
  image: formatMedia,
});

export const hydrateMicroEntry = (entry) => {
  Object.assign(entry, hydrateTimestamps(entry));
  entry.html = edjsParser.parse(entry.post);
  if (entry.socialLinks?.length) {
    entry.socialLinks = hydrateAndSortSocialLinks(entry.socialLinks);
  }
  return entry;
};

export const getMicroEntries = async () => {
  const entries = await MicroEntry.find()
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('tags')
    .lean();
  return entries.map(hydrateMicroEntry);
};

export const getMicroEntriesWithTag = async (tag) => {
  const entries = await MicroEntry.aggregate([
    {
      $lookup: {
        from: 'tags',
        localField: 'tags',
        foreignField: '_id',
        as: 'entryTag',
      },
    },
    { $match: { 'entryTag.value': tag } },
    { $sort: { createdAt: -1 } },
    { $limit: 10 },
  ]).exec();
  await MicroEntry.populate(entries, { path: 'tags' });
  return entries.map(hydrateMicroEntry);
};

export const getMicroEntry = async (slug) => {
  const entry = await MicroEntry.findOne({ slug }).populate('tags').lean();
  return hydrateMicroEntry(entry);
};
