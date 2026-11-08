import { escapeHtml } from './escapeHtml.js';

/**
 * Insert pasted text as plain text at the cursor in a contenteditable, with each newline as a <br>
 * (as Enter does there). Inserting the text whole would make the browser split it into new <div>s,
 * which saved text (links and <br> only) loses, along with the line breaks. Non-breaking spaces
 * become plain ones: copied pages are full of them (x.com puts them around @mentions), and they
 * would glue words together so lines wrap in odd places.
 * @param {string} text
 */
export function insertPlainText(text) {
  text
    .replace(/\u00a0/g, ' ')
    .split(/\r\n?|\n/)
    .forEach((line, i) => {
      if (i > 0) {
        document.execCommand('insertLineBreak');
      }
      if (line) {
        document.execCommand('insertText', false, line);
      }
    });
}

/**
 * The tools a caption's inline toolbar offers (editorConfig.js), and the sanitize rules for a
 * caption in a tool's static sanitize: the tags those tools make, and the line breaks Enter and
 * pastes put in. (Editor.js adds an inline tool's tags to a block's top-level fields by itself, but
 * not to fields nested deeper, like a gallery image's caption, so they're listed here.)
 */
export const CAPTION_INLINE_TOOLS = ['link', 'bold', 'italic'];
export const CAPTION_SANITIZE = {
  a: { href: true },
  b: {},
  i: {},
  br: true,
};

/**
 * Make a contenteditable inside an Editor.js block take pastes and Enter itself. Otherwise Editor.js
 * handles them: it splits pasted text into new paragraph blocks at each line break (it only leaves
 * <input> and <textarea> alone), and Enter starts a new block. Here a paste is inserted as plain
 * text and Enter is a line break, both staying in the field. Other keys still reach Editor.js, so
 * its shortcuts (such as adding a link) keep working.
 * @param {HTMLElement} el
 */
export function plainTextField(el) {
  el.addEventListener('paste', (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    insertPlainText(evt.clipboardData.getData('text/plain'));
  });
  keepEnterInField(el);
}

/**
 * Like plainTextField, for a field that keeps links, bold and italic (a caption): a paste keeps
 * those, as the inline toolbar would make them, and drops all other markup.
 * @param {HTMLElement} el
 */
export function inlineTextField(el) {
  el.addEventListener('paste', (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
    const html = inlineHtml(evt.clipboardData.getData('text/html'));
    if (html) {
      document.execCommand('insertHTML', false, html);
    } else {
      insertPlainText(evt.clipboardData.getData('text/plain'));
    }
  });
  keepEnterInField(el);
}

// Enter is a line break in the field, rather than Editor.js starting a new block
function keepEnterInField(el) {
  el.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter') {
      evt.preventDefault();
      evt.stopPropagation();
      document.execCommand('insertLineBreak');
    }
  });
}

const BLOCK_TAGS = new Set(['DIV', 'P', 'LI']);

// Where pasted HTML starts a new line
const PASTED_BLOCK_TAGS = new Set([
  ...BLOCK_TAGS,
  'BLOCKQUOTE',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'TR',
]);
const SKIPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'HEAD']);
// Pasted tags kept, as the tag the inline toolbar makes
const INLINE_TAGS = { A: 'a', B: 'b', STRONG: 'b', I: 'i', EM: 'i' };

/**
 * Pasted HTML as a caption's HTML: its text, links, bold and italic, with its lines (<br>s,
 * paragraphs) as <br>s. Everything else is dropped. Empty if it has no text.
 * @param {string} html
 * @returns {string}
 */
function inlineHtml(html) {
  if (!html) {
    return '';
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let out = '';
  const lineBreak = () => {
    if (out && !out.endsWith('<br>')) {
      out += '<br>';
    }
  };
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        // HTML collapses runs of whitespace (including the newlines in its source) to one space;
        // \s also matches non-breaking spaces, which become plain ones as in insertPlainText
        out += escapeHtml(child.nodeValue.replace(/\s+/g, ' '));
      } else if (child.nodeName === 'BR') {
        out += '<br>';
      } else if (
        child.nodeType === Node.ELEMENT_NODE &&
        !SKIPPED_TAGS.has(child.nodeName)
      ) {
        const block = PASTED_BLOCK_TAGS.has(child.nodeName);
        const tag = inlineTag(child);
        if (block) {
          lineBreak();
        }
        if (tag === 'a') {
          out += `<a href="${escapeHtml(child.getAttribute('href'))}">`;
        } else if (tag) {
          out += `<${tag}>`;
        }
        walk(child);
        if (tag) {
          out += `</${tag}>`;
        }
        if (block) {
          lineBreak();
        }
      }
    }
  };
  walk(doc.body);
  out = out.replace(/ *<br> */g, '<br>').replace(/^(<br>| )+|(<br>| )+$/g, '');
  return doc.body.textContent.trim() ? out : '';
}

function inlineTag(el) {
  const tag = INLINE_TAGS[el.nodeName];
  if (tag === 'a') {
    // Only links that go somewhere from the site (not "javascript:", or relative to the page
    // they were copied from)
    return /^(https?:|mailto:)/i.test(el.getAttribute('href') || '')
      ? tag
      : null;
  }
  if (tag === 'b' && /^(normal|[1-4]00)$/.test(el.style.fontWeight)) {
    // Google Docs wraps what's copied from it in <b style="font-weight:normal">
    return null;
  }
  return tag || null;
}

/**
 * A contenteditable's text, with its line breaks as newlines: each <br> is one, and so is the start
 * of each line the browser put in its own <div> or <p>. Non-breaking spaces (which browsers insert
 * to keep typed spaces visible) become plain ones.
 * @param {HTMLElement} el
 * @returns {string}
 */
export function editableText(el) {
  let text = '';
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.nodeValue;
      } else if (child.nodeName === 'BR') {
        text += '\n';
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        if (BLOCK_TAGS.has(child.nodeName) && text && !text.endsWith('\n')) {
          text += '\n';
        }
        walk(child);
      }
    }
  };
  walk(el);
  return text.replace(/\u00a0/g, ' ').trim();
}

/**
 * Plain text as a contenteditable's HTML: escaped, with newlines as <br>.
 * @param {string} text
 * @returns {string}
 */
export const plainTextHtml = (text) =>
  escapeHtml(text || '').replace(/\n/g, '<br>');
