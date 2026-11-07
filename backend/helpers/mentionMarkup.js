import * as cheerio from 'cheerio';
import fs from 'fs';
import { entityUrl } from '../../api/helpers/entityUrls.js';
import { mapPostText } from '../../api/helpers/mentions.js';
import {
  MENTION_NETWORKS,
  NETWORK_LABELS,
  getSocialLinkFromHandle,
} from '../../api/helpers/socialMedia.js';

// Show current-format mentions on the site. Each is expanded into the same h-card markup the old
// mentions tool wrote into posts, so the site's existing styles keep working, but built from the
// entity's details as they are now.

const ICON_WIDTHS = { wikipedia: 14 };
const icons = {};
for (const network of MENTION_NETWORKS) {
  const path = new URL(`../../pug/icons/${network}.svg`, import.meta.url);
  if (fs.existsSync(path)) {
    const width = ICON_WIDTHS[network] || 10;
    const svg = fs
      .readFileSync(path, 'utf8')
      .replace('<svg', `<svg style="width: ${width}px;"`);
    icons[network] =
      `<span class="cdx-mention-icon icon" style="width: ${width}px;">${svg}</span>`;
  }
}

const escapeAttribute = (text) =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');

/**
 * The h-card markup for one mention.
 * @param {Object} entity
 * @param {string} innerHtml The words as written in the post
 */
export function renderMention(entity, innerHtml) {
  const accounts = [...(entity.accounts || [])].sort(
    (a, b) =>
      MENTION_NETWORKS.indexOf(a.network) - MENTION_NETWORKS.indexOf(b.network),
  );
  const website = accounts.find((a) => a.network === 'website');
  const plain = `<span class="cdx-mention-plain">${innerHtml}</span>`;
  // An entity with a page links to it; otherwise to its website, if it has one.
  const page = entityUrl(entity);
  const name = page
    ? `<a class="entity-page p-name" href="${escapeAttribute(page)}">${plain}</a>`
    : website
      ? `<a class="website u-url p-name" href="${escapeAttribute(website.handle)}">${plain}</a>`
      : plain;
  const links = accounts
    .filter((a) => a.network !== 'website')
    .map(
      ({ network, handle }) =>
        `<a class="${network} u-url cdx-social-link" href="${escapeAttribute(getSocialLinkFromHandle(handle, network))}" data-username="${escapeAttribute(handle)}" style="padding: 0 0.025em; margin-left: 0.05em;" title="${NETWORK_LABELS[network]}">${icons[network] || NETWORK_LABELS[network]}</a>`,
    )
    .join('');
  const group = links
    ? ` <span class="cdx-mention-social-group">${links}</span>`
    : '';
  return `<span class="cdx-mention u-category h-card">${name}${group}</span>`;
}

/**
 * A copy of a post with its current-format mentions expanded for display. A mention of an
 * entity that no longer exists shows as its text.
 * @param {{blocks: Object[]}} post
 * @param {Object} entities Entities by id, from loadMentionedEntities
 */
export function expandMentionsInPost(post, entities) {
  return mapPostText(post, (html) => {
    if (!html.includes('data-entity')) {
      return html;
    }
    const $ = cheerio.load(html, null, false);
    $('span[data-entity]').each((_, el) => {
      const $mention = $(el);
      const entity = entities[$mention.attr('data-entity')];
      $mention.replaceWith(
        entity ? renderMention(entity, $mention.html()) : $mention.html(),
      );
    });
    return $.html();
  });
}
