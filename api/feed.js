import EditorJSHtml from 'editorjs-html';
import { DateTime } from 'luxon';
import { FeedEntry } from '../backend/models/feed/feedEntry.model.js';
import MicroEntry from '../backend/models/micro/microEntry.model.js';

const edjsParser = EditorJSHtml();
const ONE_MONTH = 1000 * 60 * 60 * 24 * 30;

const hydrateEntry = (entry) => {
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

const hydrateFeedEntries = (entries) =>
  entries.map((entry) => {
    entry.micro = hydrateEntry(entry.micro);
    return entry;
  });

export const getFeedEntries = async () => {
  const entries = await FeedEntry.find()
    .sort({ createdAt: -1 })
    .limit(20)
    .populate({ path: 'micro', model: MicroEntry })
    .lean();
  return hydrateFeedEntries(entries);
};

export const getEntry = async (slug) => {
  const entry = await MicroEntry.findOne({ slug }).lean();
  return hydrateEntry(entry);
};
