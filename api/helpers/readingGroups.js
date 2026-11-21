import { DateTime } from 'luxon';
import { shortDate } from './entryMeta.js';

// Articles read without commentary show as one "Read" row per day. Neighbouring reading
// entries from the same (Eastern) day are grouped where they fall in the feed, so the feed stays
// in order. An article with a summary or excerpts is an entry of its own, shown as a card.

const dayOf = (date) =>
  DateTime.fromJSDate(new Date(date), { zone: 'America/New_York' }).toISODate();

const hasText = (html) =>
  Boolean(
    String(html || '')
      .replace(/<[^>]*>/g, '')
      .trim(),
  );

/**
 * Whether a reading entry is just a read article, with nothing of its own to show beyond a line.
 * @param {Object} entry A hydrated readingShortform feed entry
 */
export const isPlainRead = (entry) =>
  !hasText(entry.shortform?.summary) &&
  !(entry.shortform?.excerpts || []).some(hasText);

/**
 * The feed's entries with neighbouring same-day reading entries grouped.
 * @param {Object[]} entries Hydrated feed entries, newest first or oldest first
 * @returns {Object[]} Entries, and groups: { entryType: 'readingGroup', day, dateText, entries }
 */
export function groupReading(entries, { now } = {}) {
  const items = [];
  for (const entry of entries) {
    if (entry.entryType !== 'readingShortform' || !isPlainRead(entry)) {
      items.push(entry);
      continue;
    }
    const day = dayOf(entry.createdAt);
    const last = items[items.length - 1];
    if (last?.entryType === 'readingGroup' && last.day === day) {
      last.entries.push(entry);
    } else {
      items.push({
        entryType: 'readingGroup',
        day,
        dateText: shortDate(day, { now }),
        entries: [entry],
      });
    }
  }
  return items;
}
