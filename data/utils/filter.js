const moment = require('moment');

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

const filter = ({ results }, req) => {
  let filteredResults = results.slice();

  // DATES
  if (req.query.startDate) {
    const startMoment = moment(req.query.startDate);
    filteredResults = filteredResults.filter((article) => {
      const m = moment(article.date);
      return m.isSameOrAfter(startMoment);
    });
  }

  if (req.query.endDate) {
    const endMoment = moment(req.query.endDate);
    filteredResults = filteredResults.filter((article) => {
      const m = moment(article.date);
      return m.isSameOrBefore(endMoment);
    });
  }

  // TAGS
  if (req.query.tags) {
    const tags = req.query.tags.split('-');
    filteredResults = filteredResults.filter((article) =>
      article.tags.some((tag) => tags.includes(tag))
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
  filteredResults.sort(function (a, b) {
    if (req.query.order && req.query.order === 'reverse') {
      return moment(a.date) - moment(b.date);
    }
    return moment(b.date) - moment(a.date);
  });

  return { results: filteredResults };
};

module.exports = filter;
