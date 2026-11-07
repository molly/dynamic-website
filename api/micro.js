import * as cheerio from 'cheerio';
import EditorJSHtml from 'editorjs-html';
import {
  loadPostContext,
  preparePostForDisplay,
} from '../backend/helpers/postContext.js';
import { entryPosts } from '../backend/helpers/links.js';
import MicroEntry from '../backend/models/micro/microEntry.model.js';
import { Tag } from '../backend/models/tag.model.js';
import { Webmention } from '../backend/models/webmention.model.js';
import {
  renderArticle,
  renderMedia,
  renderRoundup,
  renderTable,
} from './helpers/blocks.js';
import { formatGallery, formatMedia } from './helpers/media.js';
import {
  renderComparison,
  renderDocument,
  renderSocialPost,
} from './helpers/sourceBlocks.js';
import {
  NETWORK_LABELS,
  hydrateAndSortSocialLinks,
} from './helpers/socialMedia.js';
import { formatTimestamp, hydrateTimestamps } from './helpers/timestamps.js';
import { hydrateUpdates, linkCorrections } from './helpers/updates.js';

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
      case 'youtube': {
        let embed = data.embed;
        if (embed.startsWith('https://www.youtube.com/embed/')) {
          embed = embed.replace(
            'https://www.youtube.com/embed/',
            'https://www.youtube-nocookie.com/embed/',
          );
        }
        return `<iframe width="${data.width}" height="${data.height}" src="${embed}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
      }
      case 'twitter':
        return `<iframe width="${data.width}" height="${data.height}" src="${data.embed}" title="Twitter" frameborder="0" sandbox="allow-scripts"></iframe>`;
      case 'w3igg':
        return `<iframe title="Web3 is Going Just Great" height="${data.height}" width="${data.width}" src="${data.embed}" frameborder="0" sandbox=""></iframe>`;
      default:
        throw new Error(
          'Only Youtube, Twitter, and W3IGG embeds are supported right now.',
        );
    }
  },
  socialPostDelimiter: () => null, // Just used internally, should not display at all
  article: renderArticle,
  roundup: renderRoundup,
  table: renderTable,
  media: renderMedia,
  document: renderDocument,
  socialPost: renderSocialPost,
  // The block inside each side is rendered like any other.
  comparison: (block) =>
    renderComparison(block, (inner) => edjsParser.parseBlock(inner)),
  raw: ({ data }) => data.html,
  code: ({ data }) => {
    const languageClass = data.language
      ? ` class="language-${data.language}"`
      : '';
    const lineNumberClass = data.showlinenumbers ? ' class="line-numbers"' : '';
    return `<pre${lineNumberClass}><code${languageClass}>${data.code}</code></pre>`;
  },
});

const getEntryPlaintext = (entry) => {
  return entry.post.blocks
    .filter((block) =>
      ['paragraph', 'header', 'list', 'quote'].includes(block.type),
    )
    .map((block) => {
      let text;
      if (block.type === 'list') {
        if (block.data.style === 'unordered') {
          text = block.data.items.join('');
        } else {
          text = block.data.items
            .map((item, index) => `${index + 1}. ${item}`)
            .join(' ');
        }
      } else {
        text = block.data.text;
      }
      const $ = cheerio.load(text, null, false);
      return $.text();
    })
    .join(' ');
};

/**
 * Prepare a micro entry for display.
 * @param {Object} entry
 * @param {Object} [context] What the post refers to, from loadPostContext
 */
export const hydrateMicroEntry = (entry, context = {}) => {
  if (entry) {
    Object.assign(entry, { timestamps: hydrateTimestamps(entry) });
    const renderPost = (post) =>
      edjsParser.parse(preparePostForDisplay(post, context));
    entry.updates = hydrateUpdates(entry, renderPost);
    if (entry.post && entry.post.blocks) {
      entry.html = linkCorrections(
        renderPost(entry.post),
        new Set(entry.updates.map((u) => u.id)),
      );
      entry.plainText = getEntryPlaintext(entry);
    }
    if (entry.inReplyTo?.url) {
      entry.inReplyTo.networkLabel = NETWORK_LABELS[entry.inReplyTo.network];
    }
    if (entry.live?.status) {
      // The newest live update, else the last edit, is when the post last changed.
      const latest = entry.updates.find((u) => u.kind === 'live');
      entry.live.lastUpdateAt = latest ? new Date(latest.at) : entry.updatedAt;
      entry.live.lastUpdate = formatTimestamp(entry.live.lastUpdateAt);
      if (entry.live.startedAt) {
        entry.live.started = formatTimestamp(entry.live.startedAt);
      }
    }
    if (entry.socialLinks?.length) {
      entry.socialLinks = hydrateAndSortSocialLinks(entry.socialLinks);
    }
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
    .populate({ path: 'relatedPosts.ref' })
    .populate({ path: 'webmentions', model: Webmention })
    .lean();
  const context = await loadPostContext(entries.flatMap(entryPosts));
  const hydrated = entries.map((entry) => hydrateMicroEntry(entry, context));
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
    .populate({ path: 'relatedPosts.ref' })
    .populate({ path: 'webmentions', model: Webmention })
    .lean();

  const context = entry ? await loadPostContext(entryPosts(entry)) : {};
  return hydrateMicroEntry(entry, context);
};
