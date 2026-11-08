import * as cheerio from 'cheerio';
import { DateTime } from 'luxon';
import { formatTimestamp } from './timestamps.js';

// Updates, corrections and live updates under a post, and the inline corrections tied to them.

export const UPDATE_KINDS = ['update', 'correction', 'live'];
export const UPDATE_LABELS = {
  update: 'Update',
  correction: 'Correction',
  live: 'Live update',
};

/**
 * Updates in the order the site shows them: oldest first, after the post. A live post reads the
 * same way, from its first post through each live update.
 * @param {Object[]} updates
 */
export function sortUpdates(updates = []) {
  return [...updates].sort((a, b) => new Date(a.at) - new Date(b.at));
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
  return sortUpdates(entry.updates).map((update) => ({
    id: String(update._id),
    kind: update.kind,
    label: UPDATE_LABELS[update.kind],
    headline: update.kind === 'live' ? update.headline : null,
    at: update.at,
    timestamps: formatTimestamp(new Date(update.at)),
    html: update.body?.blocks ? renderPost(update.body) : [],
  }));
}

const ZONE = 'America/New_York';

/**
 * When live coverage ran, for the top of a live post, in Eastern time: "Oct 29, 5:30–5:52 pm EDT",
 * "Oct 29, 11:40 am – 1:15 pm EDT", or across days "Oct 29, 11:40 pm – Oct 30, 1:15 am EDT". With
 * no end (still updating, or nothing after the first post), just the start.
 * @param {Date|string} start
 * @param {?(Date|string)} [end]
 */
export function liveRange(start, end) {
  const from = DateTime.fromJSDate(new Date(start), { zone: ZONE });
  const to = end ? DateTime.fromJSDate(new Date(end), { zone: ZONE }) : null;
  const time = (dt) => dt.toFormat('h:mm');
  const meridiem = (dt) => dt.toFormat('a').toLowerCase();
  const zone = (to || from).toFormat('ZZZZ');
  const day = (dt) => dt.toFormat('LLL d');
  if (!to || to <= from) {
    return `${day(from)}, ${time(from)} ${meridiem(from)} ${zone}`;
  }
  if (!from.hasSame(to, 'day')) {
    return `${day(from)}, ${time(from)} ${meridiem(from)} – ${day(to)}, ${time(to)} ${meridiem(to)} ${zone}`;
  }
  return meridiem(from) === meridiem(to)
    ? `${day(from)}, ${time(from)}–${time(to)} ${meridiem(to)} ${zone}`
    : `${day(from)}, ${time(from)} ${meridiem(from)} – ${time(to)} ${meridiem(to)} ${zone}`;
}
