import { DateTime } from 'luxon';
import { makeSortBySimpleDateKey } from '../utils/dateUtils.js';
import { makeSortByWeek } from '../utils/weekUtils.js';

export const matches = (maybeValue, search) => {
  if (!maybeValue) {
    return false;
  }
  if (Array.isArray(maybeValue)) {
    return maybeValue
      .filter((entry) => typeof entry === 'string')
      .some((entry) => entry.toLowerCase().includes(search));
  } else if (typeof maybeValue === 'string') {
    return maybeValue.toLowerCase().includes(search);
  }
  return false;
};

export const filter = ({ results }, req, { defaultKey }) => {
  let filteredResults = results.slice();

  // DATES
  if (req.query.startDate) {
    const startDt = DateTime.fromISO(req.query.startDate);
    filteredResults = filteredResults.filter((article) => {
      const dt = DateTime.fromISO(article.date);
      return dt >= startDt;
    });
  }

  if (req.query.endDate) {
    const endDt = DateTime.fromISO(req.query.endDate);
    filteredResults = filteredResults.filter((article) => {
      const dt = DateTime.fromISO(article.date);
      return dt <= endDt;
    });
  }

  // TAGS AND STATUSES
  if (req.query.tags) {
    const tags = req.query.tags.split('-');
    filteredResults = filteredResults.filter((article) =>
      article.tags.some((tag) => {
        if (typeof tag === 'string') {
          return tags.includes(tag);
        }
        return tags.includes(tag.value);
      }),
    );
  }
  if (req.query.status) {
    const statuses = req.query.status.split('-');
    filteredResults = filteredResults.filter(
      (article) => article.status && statuses.includes(article.status),
    );
  }

  // SEARCH
  if (req.query.search) {
    const search = req.query.search.toLowerCase();
    filteredResults = filteredResults.filter(
      (article) =>
        matches(article.title, search) ||
        matches(article.author, search) ||
        matches(article.work, search) ||
        matches(article.publisher, search) ||
        matches(
          article.tags.map((t) => t.text),
          search,
        ) ||
        matches(article.summary, search),
    );
  }

  // ORDER
  if (defaultKey === 'SHORTFORM') {
    filteredResults.sort(makeSortByWeek(req.query.order));
  } else if (defaultKey === 'BOOK' || defaultKey === 'BLOCKCHAIN') {
    filteredResults.sort(makeSortBySimpleDateKey('started', req.query.order));
  } else {
    filteredResults.sort(makeSortBySimpleDateKey('date', req.query.order));
  }

  return { results: filteredResults };
};
