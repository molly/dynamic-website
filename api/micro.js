import EditorJSHtml from 'editorjs-html';
import { DateTime } from 'luxon';
import MicroEntry from '../backend/models/micro/microEntry.model.js';

const ONE_MONTH = 1000 * 60 * 60 * 24 * 30;

const edjsParser = EditorJSHtml({
  image: ({ data }) => {
    const source = data.file && data.file.url ? data.file.url : data.url;
    const classes = [];
    if (data.classes) {
      classes.push(data.classes);
    }
    if (data.withBorder) {
      classes.push('bordered');
    }
    if (data.stretched) {
      classes.push('full-width');
    }
    if (data.withBackground) {
      classes.push('backgrounded');
    }

    if (data.file?.contentType?.startsWith('video/')) {
      return `<video controls class="${classes.join(' ')}" src="${source}" alt="${data.alt || 'Video'}" />`;
    } else {
      return `<img class="${classes.join(' ')}" src="${source}" alt="${data.alt || 'Image'}" />`;
    }
  },
});

export const hydrateEntry = (entry) => {
  entry.html = edjsParser.parse(entry.post);
  const createdAtDt = DateTime.fromJSDate(entry.createdAt);
  entry.absoluteTime = createdAtDt.toLocaleString(DateTime.DATETIME_FULL);
  const relativeTime = DateTime.now() - createdAtDt;
  if (relativeTime < ONE_MONTH) {
    entry.humanTime = createdAtDt.toRelative();
  } else {
    entry.humanTime = entry.absoluteTime;
  }
  return entry;
};

export const getMicroEntries = async () => {
  const entries = await MicroEntry.find()
    .sort({ createdAt: -1 })
    .limit(10)
    .populate('tags')
    .lean();
  return entries.map(hydrateEntry);
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
  return entries.map(hydrateEntry);
};

export const getMicroEntry = async (slug) => {
  const entry = await MicroEntry.findOne({ slug }).populate('tags').lean();
  return hydrateEntry(entry);
};
