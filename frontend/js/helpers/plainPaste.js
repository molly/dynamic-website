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
  el.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter') {
      evt.preventDefault();
      evt.stopPropagation();
      document.execCommand('insertLineBreak');
    }
  });
}

const BLOCK_TAGS = new Set(['DIV', 'P', 'LI']);

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
