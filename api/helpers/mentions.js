import * as cheerio from 'cheerio';
import { accountKey, nameKey } from '../../backend/helpers/entityKeys.js';
import { MENTION_NETWORKS } from './socialMedia.js';

// Mentions in post text. The current format stores only which entity is mentioned:
//   <span class="mention" data-entity="ENTITY_ID">the text as written</span>
// The entity's links and handles are looked up when the post is shown or cross-posted. Older posts
// used a "legacy" format with each network's handle written into the post (span.cdx-mention).

/**
 * Ids of every entity mentioned in a set of EditorJS posts.
 * @param {{blocks: Object[]}[]} posts
 * @returns {string[]}
 */
export function collectMentionIds(posts) {
  const ids = new Set();
  for (const post of posts) {
    for (const match of JSON.stringify(post?.blocks || []).matchAll(
      /data-entity=\\"([0-9a-f]{24})\\"/g,
    )) {
      ids.add(match[1]);
    }
  }
  return [...ids];
}

const escapeText = (text) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Markup for a mention in the current format.
 * @param {string} entityId
 * @param {string} text The words as written, already escaped
 */
export function mentionMarkup(entityId, text) {
  return `<span class="mention" data-entity="${entityId}">${text}</span>`;
}

/**
 * Read a legacy mention: the name as written, and its accounts by network.
 * @param {import('cheerio').Cheerio} $mention A span.cdx-mention
 * @returns {{name: string, accounts: {network: string, handle: string}[]}}
 */
function readLegacyMention($mention) {
  const name = $mention.find('.cdx-mention-plain').text().trim();
  const accounts = [];
  for (const network of MENTION_NETWORKS) {
    const $link = $mention.find(`a.${network}`).first();
    if ($link.length) {
      const handle = $link.attr('data-username') || $link.attr('href');
      if (handle) {
        accounts.push({ network, handle: handle.trim() });
      }
    }
  }
  return { name, accounts };
}

/**
 * Every legacy mention in a piece of HTML.
 * @param {string} html
 * @returns {{name: string, accounts: Object[]}[]}
 */
export function parseLegacyMentions(html) {
  if (!html || !html.includes('cdx-mention')) {
    return [];
  }
  const $ = cheerio.load(html, null, false);
  return $('span.cdx-mention')
    .toArray()
    .map((el) => readLegacyMention($(el)));
}

/**
 * Replace legacy mentions with current-format ones. `resolve` returns the entity id for a legacy
 * mention, or null to leave that mention as it is (for example, when it's ambiguous).
 * @param {string} html
 * @param {(mention: {name: string, accounts: Object[]}) => ?string} resolve
 * @returns {string}
 */
export function replaceLegacyMentions(html, resolve) {
  if (!html || !html.includes('cdx-mention')) {
    return html;
  }
  const $ = cheerio.load(html, null, false);
  $('span.cdx-mention').each((_, el) => {
    const $mention = $(el);
    const mention = readLegacyMention($mention);
    const entityId = resolve(mention);
    if (entityId) {
      $mention.replaceWith(mentionMarkup(entityId, escapeText(mention.name)));
    }
  });
  return $.html();
}

/**
 * Apply a function to every piece of text in a post that can hold mentions.
 * @param {{blocks: Object[]}} post EditorJS data
 * @param {(html: string) => string} fn
 * @returns {{blocks: Object[]}} A new post
 */
export function mapPostText(post, fn) {
  return {
    ...post,
    blocks: (post.blocks || []).map((block) => {
      const data = { ...block.data };
      for (const key of ['text', 'caption']) {
        if (typeof data[key] === 'string') {
          data[key] = fn(data[key]);
        }
      }
      if (Array.isArray(data.items)) {
        data.items = data.items.map((item) =>
          typeof item === 'string' ? fn(item) : item,
        );
      }
      return { ...block, data };
    }),
  };
}

/**
 * A key identifying one distinct legacy mention: same name and same accounts.
 * @param {{name: string, accounts: {network: string, handle: string}[]}} mention
 */
export function mentionSignature({ name, accounts }) {
  return JSON.stringify([
    nameKey(name || ''),
    accounts.map((a) => accountKey(a.network, a.handle)).sort(),
  ]);
}
