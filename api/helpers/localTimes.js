// Times on the redesigned pages are rendered in Eastern time, then rewritten in the reader's own
// time zone by the browser (frontend/js/site.js). The server can't know a reader's zone, and the
// HTML is the same for everyone so it can be cached. Each time is marked:
//   <time datetime="<ISO>" data-local="<format>" [data-ref="<ISO>"]>Eastern text</time>
// Days that aren't moments (read dates, book dates, bill versions) aren't marked and stay as they
// are.

/**
 * The parts of a moment in a time zone, by name.
 * @param {Date} date
 * @param {Intl.DateTimeFormatOptions} options
 * @param {string} [timeZone] Undefined for the reader's own
 */
function partsOf(date, options, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    ...options,
    timeZone,
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

const sameDay = (a, b, timeZone) => {
  const day = (d) =>
    new Intl.DateTimeFormat('en-US', { timeZone, dateStyle: 'short' }).format(
      d,
    );
  return day(a) === day(b);
};

/**
 * A moment as the site writes it, in a time zone.
 *  - short:    "Nov 5, 2:53 pm", with the year when it isn't this year
 *  - day:      "Nov 5", with the year when it isn't this year
 *  - monthDay: "Nov 5", for lists already grouped by year
 *  - full:     "Saturday, November 7, 2026 · 11:24 am EST"
 *  - update:   "4:52 pm" on the same day as `ref`, otherwise as short
 *  - social:   "10:00 AM · Oct 29, 2025"
 * @param {Date} date
 * @param {string} format
 * @param {{timeZone?: string, now?: Date, ref?: Date}} [options]
 * @returns {?string} Null for a format it doesn't know
 */
export function formatLocal(
  date,
  format,
  { timeZone, now = new Date(), ref } = {},
) {
  const p = partsOf(
    date,
    {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    },
    timeZone,
  );
  const longMonth = partsOf(date, { month: 'long' }, timeZone).month;
  const thisYear = partsOf(now, { year: 'numeric' }, timeZone).year === p.year;
  const time = `${p.hour}:${p.minute} ${p.dayPeriod.toLowerCase()}`;
  const day = thisYear
    ? `${p.month} ${p.day}`
    : `${p.month} ${p.day}, ${p.year}`;
  switch (format) {
    case 'short':
      return `${day}, ${time}`;
    case 'day':
      return day;
    case 'monthDay':
      return `${p.month} ${p.day}`;
    case 'full':
      return `${p.weekday}, ${longMonth} ${p.day}, ${p.year} · ${time} ${p.timeZoneName}`;
    case 'update':
      return sameDay(date, ref || now, timeZone) ? time : `${day}, ${time}`;
    case 'date':
      return `${p.month} ${p.day}, ${p.year}`;
    case 'social':
      return `${p.hour}:${p.minute} ${p.dayPeriod} · ${p.month} ${p.day}, ${p.year}`;
    default:
      return null;
  }
}

/**
 * The full moment with its zone, for hover text: "Saturday, November 7, 2026 · 11:24 am EST".
 * @param {Date} date
 * @param {{timeZone?: string}} [options]
 */
export const fullLocal = (date, options) => formatLocal(date, 'full', options);
