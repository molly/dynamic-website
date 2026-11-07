import { DateTime } from 'luxon';
import { shortDate } from './entryMeta.js';

// Articles read without commentary show as one "Also read" row per day. Neighbouring reading
// entries from the same (Eastern) day are grouped where they fall in the feed, so the feed stays
// in order; commentary on an article is a post of its own.

const dayOf = (date) =>
  DateTime.fromJSDate(new Date(date), { zone: 'America/New_York' }).toISODate();

/**
 * The feed's entries with neighbouring same-day reading entries grouped.
 * @param {Object[]} entries Hydrated feed entries, newest first or oldest first
 * @returns {Object[]} Entries, and groups: { entryType: 'readingGroup', day, dateText, entries }
 */
export function groupReading(entries, { now } = {}) {
  const items = [];
  for (const entry of entries) {
    if (entry.entryType !== 'readingShortform') {
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
