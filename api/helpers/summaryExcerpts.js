import { htmlToText } from './html.js';

// Moving reading entries' old summaries into excerpts (backend/scripts/summariesToExcerpts.js).
// The summary field used to hold passages quoted from the article; those are now `excerpts`, plain
// text, one passage each, and `summary` is your own commentary.

// A pair of quote marks around the whole passage; the site adds its own
const WRAPPED = /^[“"‘'](.*)[”"’']$/s;

/**
 * An old summary as excerpts: its text, a passage per line (line breaks, paragraphs and list
 * items), each without quote marks around the whole of it.
 * @param {string} html
 * @returns {string[]}
 */
export function summaryToExcerpts(html) {
  return htmlToText(html)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const inner = WRAPPED.exec(line)?.[1];
      // Only when nothing inside is another quote mark: “A” and “B” isn't one quotation
      return inner && !/[“”"]/.test(inner) ? inner.trim() : line;
    });
}
