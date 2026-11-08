import { DateTime } from 'luxon';
import { shortDate } from './entryMeta.js';
import { listHref, splitChips, tagChips } from './listFilters.js';
import { formatPartialDate } from './partialDate.js';

// The reading lists (/reading/shortform, /reading/books): their filters as links, the tags beside
// them, and what each row shows. They share the press page's filters, list style and pager
// (api/helpers/listFilters.js, pug/includes/pager.pug).

export const SHORTFORM_PATH = '/reading/shortform';
export const BOOKS_PATH = '/reading/books';

// Tags listed beside a list before "all n tags"
export const VISIBLE_TAGS = 10;

export const BOOK_STATUS_FILTERS = [
  { value: '', text: 'all' },
  { value: 'currentlyReading', text: 'reading' },
  { value: 'read', text: 'read' },
  { value: 'dnf', text: 'did not finish' },
];

export const BOOK_TYPE_FILTERS = [
  { value: '', text: 'all' },
  { value: 'fiction', text: 'fiction' },
  { value: 'nonfiction', text: 'non-fiction' },
];

const BOOK_STATUS_LABELS = {
  currentlyReading: 'reading',
  read: 'read',
  dnf: 'did not finish',
  reference: 'reference',
};

const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/;

const orderParam = (order) => (order === 'reverse' ? 'reverse' : '');

/**
 * The filters a reading list was asked for, from its query string.
 * @param {Object} reqQuery
 * @returns {{tags: string[], search: string, order: string, status: string, type: string}}
 */
export function readingQuery(reqQuery = {}) {
  const status = BOOK_STATUS_FILTERS.some(
    (filter) => filter.value && filter.value === reqQuery.status,
  )
    ? reqQuery.status
    : '';
  const type = BOOK_TYPE_FILTERS.some(
    (filter) => filter.value && filter.value === reqQuery.type,
  )
    ? reqQuery.type
    : '';
  return {
    tags: reqQuery.tags ? String(reqQuery.tags).split('-') : [],
    search: reqQuery.search ? String(reqQuery.search) : '',
    order: orderParam(reqQuery.order),
    status,
    type,
  };
}

/**
 * The shortform reading list with these filters.
 * @param {{tags?: string[], search?: string, order?: string, page?: number}} filters
 */
export const shortformHref = ({
  tags = [],
  search = '',
  order = '',
  page = 1,
} = {}) =>
  listHref(SHORTFORM_PATH, { tags, search, order: orderParam(order), page });

/**
 * The books list with these filters.
 * @param {{status?: string, type?: string, tags?: string[], search?: string, order?: string,
 *   page?: number}} filters
 */
export const booksHref = ({
  status = '',
  type = '',
  tags = [],
  search = '',
  order = '',
  page = 1,
} = {}) =>
  listHref(BOOKS_PATH, {
    status,
    type,
    tags,
    search,
    order: orderParam(order),
    page,
  });

/**
 * The tags beside a list: the most used, with bars for their counts, then the rest behind
 * "all n tags". A chosen tag is always shown.
 * @param {Object[]} allTags Most used first
 * @param {string[]} chosen
 * @param {{count: Function, href: Function}} options As for tagChips
 */
export const readingTags = (allTags, chosen, options) => ({
  ...splitChips(tagChips(allTags, chosen, options), VISIBLE_TAGS),
  total: allTags.length,
});

/**
 * "Nov 1" (with the year when it isn't this year), "Nov 2026" or "2026", as precisely as the date
 * is known.
 * @param {?string} date
 * @param {{now?: DateTime}} [options]
 */
export function readingDate(date, { now } = {}) {
  if (!date) {
    return '';
  }
  return FULL_DATE.test(date)
    ? shortDate(date, { now })
    : formatPartialDate(date);
}

/**
 * What a shortform row shows besides the article's own fields: the day it was read, and when it
 * was published.
 * @param {Object} article
 * @param {{now?: DateTime}} [options]
 */
export function shortformRow(article, { now } = {}) {
  return {
    ...article,
    readLabel: readingDate(article.started, { now }),
    publishedLabel: readingDate(article.date, { now }),
  };
}

// "Oct 16 → Oct 24, 2026", or with both years when they differ
function readingSpan(started, completed) {
  const start = DateTime.fromISO(started);
  const end = DateTime.fromISO(completed);
  const startText = start.toFormat(
    start.year === end.year ? 'LLL d' : 'LLL d, yyyy',
  );
  return `${startText} → ${end.toFormat('LLL d, yyyy')}`;
}

/**
 * When a book was read: "Oct 16 → Oct 24, 2026" (one date when started and finished the same
 * day), "started Oct 16", or "finished Oct 24".
 * @param {{started?: string, completed?: string}} book
 * @param {{now?: DateTime}} [options]
 * @returns {string}
 */
export function bookReadingDates({ started, completed }, { now } = {}) {
  const fullStart = started && FULL_DATE.test(started) ? started : null;
  const fullEnd = completed && FULL_DATE.test(completed) ? completed : null;
  if (fullStart && fullEnd) {
    return fullStart >= fullEnd
      ? DateTime.fromISO(fullEnd).toFormat('LLL d, yyyy')
      : readingSpan(fullStart, fullEnd);
  }
  if (completed) {
    return `finished ${readingDate(completed, { now })}`;
  }
  if (started) {
    return `started ${readingDate(started, { now })}`;
  }
  return '';
}

/**
 * What a book row shows besides the book's own fields.
 * @param {Object} book
 * @param {{now?: DateTime}} [options]
 */
export function bookRow(book, { now = DateTime.now() } = {}) {
  const year = book.date ? String(book.date).slice(0, 4) : '';
  const upcoming = Boolean(year) && DateTime.fromISO(book.date) > now;
  return {
    ...book,
    publishedLabel: year
      ? `${upcoming ? 'to be published' : 'published'} ${year}`
      : '',
    statusLabel: BOOK_STATUS_LABELS[book.status] || '',
    readingDates: bookReadingDates(book, { now }),
  };
}
