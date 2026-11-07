import { DateTime } from 'luxon';

/**
 * A date typed without a time ("2025-05-29", from a date input) as midnight Eastern, so it shows
 * as that day wherever the site displays dates in Eastern time. A plain "2025-05-29" would
 * otherwise be read as midnight UTC, which is the evening before in Eastern. Anything else is
 * left for Mongoose to cast.
 * @param {*} value
 */
export function easternDate(value) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return DateTime.fromISO(value.trim(), {
      zone: 'America/New_York',
    }).toJSDate();
  }
  return value;
}
