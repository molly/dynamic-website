import * as cheerio from 'cheerio';
import { isItalicEntity } from '../../api/helpers/entityTypes.js';
import { entityUrl } from '../../api/helpers/entityUrls.js';
import { escapeHtml } from '../../api/helpers/html.js';
import {
  DOCUMENT_SIDES,
  withDocumentSides,
} from '../../api/helpers/documentParties.js';
import { mapPostText } from '../../api/helpers/mentions.js';

// Show current-format mentions on the site: the words as written, linked to the entity's page, or
// to its website if it has no page.

const escapeAttribute = (text) =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');

// Where an entity's name links: its page if it has one, otherwise its (first) website, if any.
function entityLinkTarget(entity) {
  const page = entityUrl(entity);
  if (page) {
    return { href: page, className: 'entity-page p-name' };
  }
  const website = (entity.accounts || []).find(
    (a) => a.network === 'website',
  )?.handle;
  return website ? { href: website, className: 'website u-url p-name' } : null;
}

// A case's or outlet's name in italics, as titles are. Not in mentions in post text, where the
// words are as you wrote them, italics or not.
const styledName = (entity, html) =>
  isItalicEntity(entity) ? `<i>${html}</i>` : html;

/**
 * An entity's name, linked to its page (or its website, if it has no page), without the account
 * icons a mention in post text has. For the "about" row beside a post.
 * @param {Object} entity
 * @returns {string}
 */
export function entityNameLink(entity) {
  const name = styledName(entity, escapeHtml(entity.name));
  const target = entityLinkTarget(entity);
  return target
    ? `<a class="${target.className}" href="${escapeAttribute(target.href)}">${name}</a>`
    : name;
}

// Names as a list: "A", "A and B", "A, B and C"
const nameList = (names) =>
  names.length > 1
    ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
    : names[0] || null;

/**
 * Who wrote or hosted a press piece, as HTML: its author entities, each linked like a name beside
 * a post, or else its author as written.
 * @param {{author?: string, authors?: Object[]}} press authors populated
 * @returns {?string}
 */
export function pressAuthorHtml(press) {
  const entities = (press.authors || []).filter((e) => e?.name);
  if (entities.length) {
    return nameList(entities.map(entityNameLink));
  }
  return press.author ? escapeHtml(press.author) : null;
}

/**
 * Who was in a talk or appearance, as HTML: the host (pressAuthorHtml), then the others, linked.
 * "Ezra Klein, Paul Grewal and Jo".
 * @param {{author?: string, authors?: Object[], people?: Object[]}} press populated
 * @returns {?string}
 */
export function pressWithHtml(press) {
  const host = pressAuthorHtml(press);
  return nameList([
    ...(host ? [host] : []),
    ...(press.people || []).filter((e) => e?.name).map(entityNameLink),
  ]);
}

/**
 * One mention: the words as written, linked to the entity's page (or its website).
 * @param {Object} entity
 * @param {string} innerHtml The words as written in the post
 */
export function renderMention(entity, innerHtml) {
  const target = entityLinkTarget(entity);
  const name = target
    ? `<a class="mention-name ${target.className}" href="${escapeAttribute(target.href)}">${innerHtml}</a>`
    : `<span class="mention-name p-name">${innerHtml}</span>`;
  return `<span class="mention h-card">${name}</span>`;
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
// written in bold, linked to the entity's page or website, for renderDocument. Not the dotted-underline
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
      const bold = `<strong>${styledName(entity, escapeHtml(name))}</strong>`;
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
