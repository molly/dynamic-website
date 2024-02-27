import EditorJSHtml from 'editorjs-html';
import { DateTime } from 'luxon';
import MicroEntry from '../backend/models/micro/microEntry.model.js';
import { formatMedia } from './helpers/media.js';

const ONE_MONTH = 1000 * 60 * 60 * 24 * 30;
const SOCIAL_PREFIXES = {
  twitter: 'https://twitter.com/molly0xFFF/',
  mastodon: 'https://hachyderm.io/@molly0xfff/',
  bluesky: 'https://bsky.app/profile/molly.wiki/post/',
  tiktok: 'https://www.tiktok.com/@molly0xfff/',
  youtube: 'https://www.youtube.com/watch?v=',
};

const edjsParser = EditorJSHtml({
  image: formatMedia,
});

function hydrateAndSortSocialLinks(links) {
  const order = ['twitter', 'mastodon', 'bluesky', 'tiktok', 'youtube'];
  links.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  for (const link of links) {
    link.href = `${SOCIAL_PREFIXES[link.type]}${link.postId}`;
  }
  return links;
}

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
