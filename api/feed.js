import EditorJSHtml from 'editorjs-html';
import { FeedEntry } from '../backend/models/feed/feedEntry.model.js';
import MicroEntry from '../backend/models/micro/microEntry.model.js';

const edjsParser = EditorJSHtml();
const ONE_DAY = 1000 * 60 * 60 * 24;
const ONE_WEEK = ONE_DAY * 7;
const ONE_MONTH = ONE_DAY * 30;

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'EST',
});

const hydrateEntry = (entry) => {
  entry.html = edjsParser.parse(entry.post);
  entry.absoluteTime = dateTimeFormatter.format(entry.createdAt);
  const relativeTime = Date.now() - entry.createdAt;
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
  console.log(entry);
  return hydrateEntry(entry);
};
