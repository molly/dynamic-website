import { DateTime } from 'luxon';

// Dates known only as precisely as the sources say: a year ("2019"), a month ("2019-03") or a day
// ("2019-03-05"). Stored as that text, so the precision is kept and they still sort in date order.
// Used for when relations start and end, and for events' start and end dates.

const PARTIAL = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

/**
 * The date as stored, or null if it isn't a real year, month or day in one of those forms.
 * @param {*} value
 * @returns {?string}
 */
export function normalizePartialDate(value) {
  const text = String(value ?? '').trim();
  const match = PARTIAL.exec(text);
  if (!match) {
    return null;
  }
  const [, year, month, day] = match;
  const date = DateTime.fromObject({
    year: Number(year),
    month: month ? Number(month) : 1,
    day: day ? Number(day) : 1,
  });
  return date.isValid ? text : null;
}

/**
 * For showing: "2019", "Mar 2019" or "Mar 5, 2019".
 * @param {?string} value
 */
export function formatPartialDate(value) {
  const text = normalizePartialDate(value);
  if (!text) {
    return '';
  }
  const [year, month, day] = text.split('-').map(Number);
  if (!month) {
    return String(year);
  }
  const date = DateTime.fromObject({ year, month, day: day || 1 });
  return date.toFormat(day ? 'LLL d, yyyy' : 'LLL yyyy');
}

// For the admin form's text box
export const PARTIAL_DATE_PATTERN = '\\d{4}(-\\d{2}(-\\d{2})?)?';
export const PARTIAL_DATE_PLACEHOLDER = 'YYYY, YYYY-MM or YYYY-MM-DD';
