import { ArchivedLink } from '../models/archivedLink.model.js';
import { Entity } from '../models/entity.model.js';
import { ShortformEntry } from '../models/entry.model.js';
import { extractUrlsFromBlocks } from './links.js';
import { expandMentionsInPost, loadMentionedEntities } from './mentions.js';

// What a post needs looked up before it can be shown: mentioned entities, the reading entries
// that article cards and roundups point at, and Wayback copies of the links it shows.

// The fields the article card and roundup blocks show.
export const SHORTFORM_CARD_FIELDS =
  'title subtitle author work publisher href date excerpts completed started entryAdded paywalled giftLink outlet';

// The outlet fields a card needs: whether its articles are paywalled unless marked otherwise.
export const OUTLET_CARD_POPULATE = {
  path: 'outlet',
  model: Entity,
  select: 'name paywalledByDefault',
};

// A micro post's related posts, with what their cards need.
export const RELATED_POPULATE = {
  path: 'relatedPosts.ref',
  populate: OUTLET_CARD_POPULATE,
};

// A post's blocks, with the blocks inside comparisons.
const withNestedBlocks = (blocks = []) =>
  blocks.flatMap((block) =>
    block.type === 'comparison'
      ? [
          block,
          ...[block.data?.left?.block, block.data?.right?.block].filter(
            Boolean,
          ),
        ]
      : [block],
  );

function referencedShortformIds(posts) {
  const ids = new Set();
  for (const post of posts) {
    for (const block of withNestedBlocks(post?.blocks)) {
      if (block.type === 'article' && block.data?.ref) {
        ids.add(String(block.data.ref));
      } else if (block.type === 'roundup') {
        for (const item of block.data?.items || []) {
          if (item.ref) {
            ids.add(String(item.ref));
          }
        }
      }
    }
  }
  return [...ids];
}

async function loadReferencedShortform(posts) {
  const ids = referencedShortformIds(posts);
  if (!ids.length) {
    return {};
  }
  const entries = await ShortformEntry.find(
    { _id: { $in: ids } },
    SHORTFORM_CARD_FIELDS,
  )
    .populate(OUTLET_CARD_POPULATE)
    .lean();
  return Object.fromEntries(entries.map((e) => [String(e._id), e]));
}

/**
 * Wayback copies of these URLs, as { url: archiveUrl }, for the ones archived successfully.
 * @param {string[]} urls
 */
export async function loadArchives(urls) {
  const unique = [...new Set(urls.filter(Boolean))];
  if (!unique.length) {
    return {};
  }
  const records = await ArchivedLink.find(
    { url: { $in: unique }, status: 'ok' },
    'url archiveUrl',
  ).lean();
  return Object.fromEntries(records.map((r) => [r.url, r.archiveUrl]));
}

/**
 * Look up everything a set of posts refers to.
 * @param {{blocks: Object[]}[]} posts
 * @param {{urls?: string[]}} [options] urls: other links shown with the posts (related posts)
 * @returns {Promise<{mentions: Object, shortform: Object, archived: Object}>}
 */
export async function loadPostContext(posts, { urls = [] } = {}) {
  const [mentions, shortform] = await Promise.all([
    loadMentionedEntities(posts),
    loadReferencedShortform(posts),
  ]);
  const archived = await loadArchives([
    ...posts.flatMap((post) => extractUrlsFromBlocks(post?.blocks || [])),
    ...Object.values(shortform).map((entry) => entry.href),
    ...urls,
  ]);
  return { mentions, shortform, archived };
}

/**
 * A copy of a post ready for the site's renderer: mentions expanded, current reading entries
 * attached to article cards and roundups, and on every block `archived` (url -> Wayback copy).
 * Quotes get `contextUrl` when the post links to exactly one article (`quoteSource`), so they can
 * link to where they appear in it.
 * @param {{blocks: Object[]}} post
 * @param {{mentions?: Object, shortform?: Object, archived?: Object}} context From loadPostContext
 * @param {{quoteSource?: string}} [options]
 */
export function preparePostForDisplay(
  post,
  { mentions = {}, shortform = {}, archived = {} } = {},
  { quoteSource } = {},
) {
  const expanded = expandMentionsInPost(post, mentions);
  const prepare = (block) => {
    const prepared = { ...attachEntries(block, shortform), archived };
    if (prepared.type === 'quote' && quoteSource) {
      prepared.data = {
        ...prepared.data,
        contextUrl: textFragmentUrl(quoteSource, prepared.data.text),
      };
    }
    if (prepared.type === 'comparison') {
      const side = (slot) =>
        slot?.block ? { ...slot, block: prepare(slot.block) } : slot;
      prepared.data = {
        ...prepared.data,
        left: side(prepared.data.left),
        right: side(prepared.data.right),
      };
    }
    return prepared;
  };
  return { ...expanded, blocks: expanded.blocks.map(prepare) };
}

/**
 * A link to a passage in a page: the URL with a text fragment for the passage's first words.
 * @param {string} url
 * @param {string} html The passage
 */
export function textFragmentUrl(url, html) {
  const words = String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .join(' ');
  if (!words) {
    return url;
  }
  // "-" and "," mean something in a text fragment, so they're escaped too.
  const fragment = encodeURIComponent(words).replace(/-/g, '%2D');
  return `${url.split('#')[0]}#:~:text=${fragment}`;
}

// Current reading entries for article cards and roundups. (preparePostForDisplay reaches the
// blocks inside comparisons.)
function attachEntries(block, shortform) {
  if (block.type === 'article') {
    return {
      ...block,
      data: { ...block.data, entry: shortform[String(block.data.ref)] },
    };
  }
  if (block.type === 'roundup') {
    return {
      ...block,
      data: {
        ...block.data,
        items: (block.data.items || []).map((item) => ({
          ...item,
          entry: shortform[String(item.ref)],
        })),
      },
    };
  }
  return block;
}
