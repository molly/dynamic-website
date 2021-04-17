const moment = require('moment');
const MOMENT_FORMATS = ['YYYY-MM-DD', 'YYYY-MM', 'YYYY'];

const matches = (maybeValue, search) => {
  if (!maybeValue) {
    return false;
  }
  if (Array.isArray(maybeValue)) {
    return maybeValue.some((entry) => entry.toLowerCase().includes(search));
  } else if (typeof maybeValue === 'string') {
    return maybeValue.toLowerCase().includes(search);
  }
  return false;
};

function makeSortBySimpleDateKey(order, key) {
  return function (a, b) {
    const sortValA = moment(a[key], MOMENT_FORMATS);
    const sortValB = moment(b[key], MOMENT_FORMATS);
    if (order && order === 'reverse') {
      return sortValA - sortValB;
    }
    return sortValB - sortValA;
  };
}

const SAME_MONTH_REGEX = new RegExp(/([A-Za-z]+ \d{1,2})–\d{1,2}(, \d{4})/);
const DIFFERENT_MONTHS_REGEX = new RegExp(
  /([A-Za-z]+ \d{1,2})–[A-Za-z]+ \d{1,2}(, \d{4})/
);
function getMomentFromWeek(week) {
  const sameMatch = week.match(SAME_MONTH_REGEX);
  if (sameMatch) {
    return moment(sameMatch[1] + sameMatch[2], 'MMMM D, YYYY');
  }
  const differentMatch = week.match(DIFFERENT_MONTHS_REGEX);
  if (differentMatch) {
    return moment(differentMatch[1] + differentMatch[2], 'MMMM D, YYYY');
  }
  return moment('1970-01-01', MOMENT_FORMATS);
}

function makeSortByWeek(order) {
  return function (a, b) {
    const sortValA = getMomentFromWeek(a.week);
    const sortValB = getMomentFromWeek(b.week);
    if (order && order === 'reverse') {
      return sortValA - sortValB;
    }
    return sortValB - sortValA;
  };
}

const filter = ({ results }, req, { defaultKey }) => {
  let filteredResults = results.slice();

  // DATES
  if (req.query.startDate) {
    const startMoment = moment(req.query.startDate, [
      'YYYY-MM-DD',
      'YYYY-MM',
      'YYYY',
    ]);
    filteredResults = filteredResults.filter((article) => {
      const m = moment(article.date, MOMENT_FORMATS);
      return m.isSameOrAfter(startMoment);
    });
  }

  if (req.query.endDate) {
    const endMoment = moment(req.query.endDate, [
      'YYYY-MM-DD',
      'YYYY-MM',
      'YYYY',
    ]);
    filteredResults = filteredResults.filter((article) => {
      const m = moment(article.date, MOMENT_FORMATS);
      return m.isSameOrBefore(endMoment);
    });
  }

  // TAGS AND STATUSES
  if (req.query.tags) {
    const tags = req.query.tags.split('-');
    filteredResults = filteredResults.filter((article) =>
      article.tags.some((tag) => tags.includes(tag.value))
    );
  }
  if (req.query.status) {
    const statuses = req.query.status.split('-');
    filteredResults = filteredResults.filter(
      (article) => article.status && statuses.includes(article.status)
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
        matches(article.tags, search) ||
        matches(article.summary, search)
    );
  }

  // ORDER
  if (defaultKey === 'DIB') {
    filteredResults.sort(makeSortByWeek(req.query.order));
  } else if (defaultKey === 'BOOK') {
    filteredResults.sort(makeSortBySimpleDateKey(req.query.order, 'started'));
  } else {
    filteredResults.sort(makeSortBySimpleDateKey(req.query.order, 'date'));
  }

  return { results: filteredResults };
};

module.exports = filter;
