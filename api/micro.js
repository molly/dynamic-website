import EditorJSHtml from 'editorjs-html';
import db from '../backend/models/db.js';
import MicroEntry from '../backend/models/micro/microEntry.model.js';
import { Tag } from '../backend/models/tag.model.js';
import { formatGallery, formatMedia } from './helpers/media.js';
import { hydrateAndSortSocialLinks } from './helpers/socialMedia.js';
import { hydrateTimestamps } from './helpers/timestamps.js';

const edjsParser = EditorJSHtml({
  gallery: formatGallery,
  image: formatMedia,
  quote: ({ data }) => {
    let cite = '';
    if (data.caption) {
      cite = `<cite>– ${data.caption}</cite>`;
    }
    return `<div class="quote"><blockquote>${data.text}</blockquote>${cite}</div>`;
  },
  embed: ({ data }) => {
    switch (data.service) {
      case 'youtube':
        return `<iframe width="${data.width}" height="${data.height}" src="${data.embed}" title="YouTube video player" frameborder="0" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
      case 'twitter':
        return `<iframe width="${data.width}" height="${data.height}" src="${data.embed}" title="Twitter" frameborder="0" sandbox=""></iframe>`;
      case 'w3igg':
        return `<iframe title="Web3 is Going Just Great" height="${data.height}" width="${data.width}" src="${data.embed}" frameborder="0" sandbox=""></iframe>`;
      default:
        throw new Error(
          'Only Youtube, Twitter, and W3IGG embeds are supported right now.',
        );
    }
  },
  socialPostDelimiter: () => null, // Just used internally, should not display at all
  raw: ({ data }) => data.html,
});

export const hydrateMicroEntry = (entry) => {
  Object.assign(entry, { timestamps: hydrateTimestamps(entry) });
  if (entry.post && entry.post.blocks) {
    entry.html = edjsParser.parse(entry.post);
  }
  if (entry.socialLinks?.length) {
    entry.socialLinks = hydrateAndSortSocialLinks(entry.socialLinks);
  }
  return entry;
};

export const getMicroEntries = async ({
  query = {},
  start = 0,
  limit = 10,
} = {}) => {
  let q = MicroEntry.find({ deletedAt: { $exists: false }, ...query }).sort({
    createdAt: -1,
  });

  if (start) {
    q = q.skip(start);
  }
  if (limit) {
    q = q.limit(limit);
  }
  const entries = await q
    .populate({ path: 'tags', model: Tag, options: { sort: { value: 1 } } })
    .populate({ path: 'relatedPost', connection: db.readingListConnection })
    .lean();
  const hydrated = entries.map(hydrateMicroEntry);
  const totalResults = await MicroEntry.countDocuments(query);
  let totalUnfilteredResults = totalResults;
  if (query) {
    totalUnfilteredResults = await MicroEntry.countDocuments({});
  }

  return { entries: hydrated, totalResults, totalUnfilteredResults };
};

export const getMicroEntry = async (slug) => {
  const entry = await MicroEntry.findOne({ slug })
    .populate({ path: 'tags', model: Tag, options: { sort: { value: 1 } } })
    .populate({ path: 'relatedPost', connection: db.readingListConnection })
    .lean();

  return hydrateMicroEntry(entry);
};
