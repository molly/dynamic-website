import { DateTime } from 'luxon';

// <input type="datetime-local"> holds a date and time with no zone. The editor's are in the
// computer's own time zone; the database stores instants (UTC). Minutes only: the inputs have
// step="60", and seconds are dropped.

/** @param {string|Date|null} value An ISO string or Date */
export function toLocalInput(value) {
  if (!value) {
    return '';
  }
  const dt =
    value instanceof Date
      ? DateTime.fromJSDate(value)
      : DateTime.fromISO(value);
  return dt.isValid ? dt.toLocal().toFormat("yyyy-MM-dd'T'HH:mm") : '';
}

/** @returns {string|null} ISO, or null when the input is empty */
export function fromLocalInput(text) {
  if (!text) {
    return null;
  }
  const dt = DateTime.fromISO(text);
  return dt.isValid ? dt.toUTC().toISO() : null;
}

export const nowLocalInput = () => toLocalInput(new Date());

/**
 * A new ObjectId-shaped id (seconds since 1970, then random), so an update can be referred to
 * before it's saved: corrections in the post point at their note by id.
 */
export function newObjectId() {
  const seconds = Math.floor(Date.now() / 1000)
    .toString(16)
    .padStart(8, '0');
  const random = [...crypto.getRandomValues(new Uint8Array(8))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return seconds + random;
}
