import * as cheerio from 'cheerio';
import { formatTimestamp } from './timestamps.js';

// Updates, corrections and live updates under a post, and the inline corrections tied to them.

export const UPDATE_KINDS = ['update', 'correction', 'live'];
export const UPDATE_LABELS = {
  update: 'Update',
  correction: 'Correction',
  live: 'Live update',
};

/**
 * Updates in the order the site shows them: a live post's newest first, like a live blog;
 * otherwise oldest first, as notes after the post.
 * @param {Object[]} updates
 * @param {boolean} isLive
 */
export function sortUpdates(updates = [], isLive = false) {
  return [...updates].sort((a, b) =>
    isLive ? new Date(b.at) - new Date(a.at) : new Date(a.at) - new Date(b.at),
  );
}

/**
 * Point each inline correction at the note that explains it: a correction mark carrying
 * data-update="<id>" gets a link to that update, if the update exists.
 * @param {string[]} htmlBlocks The post as rendered, one string per block
 * @param {Set<string>} updateIds
 * @returns {string[]}
 */
export function linkCorrections(htmlBlocks, updateIds) {
  return htmlBlocks.map((html) => {
    if (typeof html !== 'string' || !html.includes('data-update')) {
      return html;
    }
    const $ = cheerio.load(html, null, false);
    $('ins.correction[data-update]').each((_, el) => {
      const id = $(el).attr('data-update');
      if (updateIds.has(id)) {
        $(el).after(
          `<a class="correction-note" href="#update-${id}" title="See the correction note">†</a>`,
        );
      }
    });
    return $.html();
  });
}

/**
 * Updates ready for the template.
 * @param {Object} entry With updates and live
 * @param {(post: Object) => string[]} renderPost Renders an update's EditorJS body
 */
export function hydrateUpdates(entry, renderPost) {
  const isLive = Boolean(entry.live?.status);
  return sortUpdates(entry.updates, isLive).map((update) => ({
    id: String(update._id),
    kind: update.kind,
    label: UPDATE_LABELS[update.kind],
    headline: update.kind === 'live' ? update.headline : null,
    at: update.at,
    timestamps: formatTimestamp(new Date(update.at)),
    html: update.body?.blocks ? renderPost(update.body) : [],
  }));
}
