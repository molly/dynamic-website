import * as cheerio from 'cheerio';
import fs from 'fs';
import { entityUrl } from '../../api/helpers/entityUrls.js';
import { escapeHtml } from '../../api/helpers/html.js';
import {
  DOCUMENT_SIDES,
  withDocumentSides,
} from '../../api/helpers/documentParties.js';
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
// The accounts' icons, and Wikipedia's for the article about them
for (const network of [...MENTION_NETWORKS, 'wikipedia']) {
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

// Where an entity's name links: its page if it has one, otherwise its website, if any.
function entityLinkTarget(entity) {
  const page = entityUrl(entity);
  if (page) {
    return { href: page, className: 'entity-page p-name' };
  }
  const website = (entity.accounts || []).find((a) => a.network === 'website');
  return website
    ? { href: website.handle, className: 'website u-url p-name' }
    : null;
}

/**
 * An entity's name, linked to its page (or its website, if it has no page), without the account
 * icons a mention in post text has. For the "about" row beside a post.
 * @param {Object} entity
 * @returns {string}
 */
export function entityNameLink(entity) {
  const name = escapeHtml(entity.name);
  const target = entityLinkTarget(entity);
  return target
    ? `<a class="${target.className}" href="${escapeAttribute(target.href)}">${name}</a>`
    : name;
}

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
  const plain = `<span class="cdx-mention-plain">${innerHtml}</span>`;
  const target = entityLinkTarget(entity);
  const name = target
    ? `<a class="${target.className}" href="${escapeAttribute(target.href)}">${plain}</a>`
    : plain;
  const links = accounts
    .filter((a) => a.network !== 'website')
    .map(
      ({ network, handle }) =>
        `<a class="${network} u-url cdx-social-link" href="${escapeAttribute(getSocialLinkFromHandle(handle, network))}" data-username="${escapeAttribute(handle)}" style="padding: 0 0.025em; margin-left: 0.05em;" title="${NETWORK_LABELS[network]}">${icons[network] || NETWORK_LABELS[network]}</a>`,
    )
    .join('');
  // The Wikipedia article about them comes after their own accounts. Not u-url: it isn't theirs.
  const article = entity.ids?.wikipedia
    ? `<a class="wikipedia cdx-social-link" href="${escapeAttribute(entity.ids.wikipedia)}" style="padding: 0 0.025em; margin-left: 0.05em;" title="Wikipedia article">${icons.wikipedia || 'Wikipedia'}</a>`
    : '';
  const group =
    links || article
      ? ` <span class="cdx-mention-social-group">${links}${article}</span>`
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
  const expanded = mapPostText(post, (html) => {
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
  return {
    ...expanded,
    blocks: expanded.blocks.map((block) =>
      expandDocumentParties(block, entities),
    ),
  };
}

// A document's senders and recipients that are entities: each person's `html`, the name as
// written in bold, linked to the entity's page or website, for renderDocument. Not the purple @
// mention style, which is for your own writing; this is the document's own details. Documents
// inside comparisons too.
function expandDocumentParties(block, entities) {
  if (block?.type === 'comparison') {
    const side = (slot) =>
      slot?.block
        ? { ...slot, block: expandDocumentParties(slot.block, entities) }
        : slot;
    return {
      ...block,
      data: {
        ...block.data,
        left: side(block.data?.left),
        right: side(block.data?.right),
      },
    };
  }
  if (block?.type !== 'document') {
    return block;
  }
  // Only ever made here, never taken from saved data, since it's shown as HTML
  const data = withDocumentSides(block.data);
  for (const side of DOCUMENT_SIDES) {
    data[side].people = data[side].people.map((saved) => {
      const person = { ...saved };
      delete person.html;
      const entity = entities[String(person.entity?._id)];
      const name = person.name || entity?.name;
      if (!entity || !name) {
        return person;
      }
      const bold = `<strong>${escapeHtml(name)}</strong>`;
      const target = entityLinkTarget(entity);
      return {
        ...person,
        html: target
          ? `<a class="document-party" href="${escapeAttribute(target.href)}">${bold}</a>`
          : bold,
      };
    });
  }
  return { ...block, data };
}
