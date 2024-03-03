import EditorJSHtml from 'editorjs-html';
import db from '../backend/models/db.js';
import MicroEntry from '../backend/models/micro/microEntry.model.js';
import { Tag } from '../backend/models/tag.model.js';
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

export const getMicroEntries = async (query = {}) => {
  const entries = await MicroEntry.find(query)
    .sort({ createdAt: -1 })
    .limit(10)
    .populate({ path: 'tags', model: Tag, options: { sort: { value: 1 } } })
    .populate({ path: 'relatedPost', connection: db.readingListConnection })
    .lean();
  return entries.map(hydrateMicroEntry);
};

export const getMicroEntry = async (slug) => {
  const entry = await MicroEntry.findOne({ slug })
    .populate({ path: 'tags', model: Tag, options: { sort: { value: 1 } } })
    .populate({ path: 'relatedPost', connection: db.readingListConnection })
    .lean();
  return hydrateMicroEntry(entry);
};
