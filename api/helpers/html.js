import * as cheerio from 'cheerio';

// Small HTML helpers shared by the site's block renderers and the social post fetcher.

export const escapeHtml = (text) =>
  String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const SAFE_HREF = /^(https?:|mailto:)/i;

/**
 * Keep only the listed tags (and only href on links, and only http, https and mailto links); other
 * tags are replaced by their contents, and scripts, styles and comments are removed.
 * @param {string} html
 * @param {string[]} [tags] Allowed tag names
 * @returns {string}
 */
export function cleanHtml(html, tags = ['a', 'br']) {
  if (!html) {
    return '';
  }
  const allowed = new Set(tags);
  const $ = cheerio.load(String(html), null, false);
  $('script, style, iframe, object, embed').remove();
  // Deepest first, so unwrapping a parent never skips its children.
  $('*')
    .toArray()
    .reverse()
    .forEach((el) => {
      const $el = $(el);
      const name = el.tagName.toLowerCase();
      if (!allowed.has(name)) {
        $el.replaceWith($el.contents());
        return;
      }
      const href = $el.attr('href');
      for (const attr of Object.keys(el.attribs)) {
        $el.removeAttr(attr);
      }
      if (name === 'a') {
        if (href && SAFE_HREF.test(href.trim())) {
          $el.attr('href', href.trim());
        } else {
          $el.replaceWith($el.contents());
        }
      }
    });
  $.root()
    .contents()
    .filter((_, node) => node.type === 'comment')
    .remove();
  return $.html();
}

const LINE_TAGS = new Set(['div', 'p', 'li']);

/**
 * HTML as plain text: <br> and the start of each line in its own <div>, <p> or <li> become
 * newlines, entities are decoded, non-breaking spaces become plain ones, and other tags are
 * dropped (keeping their text). For fields that hold plain text but were once saved as HTML, like
 * image alt text.
 * @param {string} html
 * @returns {string}
 */
export function htmlToText(html) {
  if (!html) {
    return '';
  }
  const $ = cheerio.load(String(html), null, false);
  let text = '';
  const walk = (nodes) => {
    for (const node of nodes) {
      if (node.type === 'text') {
        text += node.data;
      } else if (node.type === 'tag') {
        const name = node.name.toLowerCase();
        if (name === 'br') {
          text += '\n';
          continue;
        }
        if (LINE_TAGS.has(name) && text && !text.endsWith('\n')) {
          text += '\n';
        }
        walk(node.children || []);
      }
    }
  };
  walk($.root().contents().toArray());
  return text.replace(/\u00a0/g, ' ').trim();
}
