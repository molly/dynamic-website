import EditorJSHtml from 'editorjs-html';
import { DateTime } from 'luxon';
import MicroEntry from '../backend/models/micro/microEntry.model.js';

const edjsParser = EditorJSHtml({
  image: ({ data }) => {
    let alt = data.alt ? data.alt : 'Image';
    return `<img src="${
      data.file && data.file.url ? data.file.url : data.url
    }" alt="${alt}" />`;
  },
});

const ONE_MONTH = 1000 * 60 * 60 * 24 * 30;

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
