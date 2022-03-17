const moment = require('moment');
const path = require('path');
const pug = require('pug');

const preprocess = require('./preprocess');
const { getMomentFromWeek } = require('../utils/weekUtils');
const { makeSortBySimpleDateKey } = require('../utils/dateUtils');

const SHORTFORM_DEFAULTS = require('../shortformDefaults');

// Trim the summary to length characters without splitting words, then append ellipses
const getSummaryExcerpt = (summary, length) => {
  if (summary.length <= length) {
    return summary;
  }
  const trimmed = summary.substr(0, summary.lastIndexOf(' ', length));
  return trimmed + '...';
};

const makeSummary = (article) => {
  let summary = `"${article.title}"`;
  if (article.parenthetical) {
    summary += ` (${article.parenthetical})`;
  }

  if (article.parenthetical || !article.title.match(/[.?!]$/m)) {
    summary += '. ';
  } else {
    summary += ' ';
  }

  if (article.author) {
    summary += article.author;
  }
  if (article.work || article.publisher) {
    summary += ` ${article.preposition} ${article.work || article.publisher}`;
  }

  if (article.formattedDate) {
    summary += ` on ${article.formattedDate}.`;
  } else if (article.author || article.work || article.publisher) {
    summary += '.';
  }
  if (article.summary) {
    const textOnlySummary = article.summary.replace(/(<([^>]+)>)/gi, '');
    const trimmedSummary = getSummaryExcerpt(textOnlySummary, 200);
    return summary + ' ' + trimmedSummary;
  }
  return summary;
};

const getRssResults = (data, template) => {
  const shortformPugTemplate = pug.compileFile(
    path.join(__dirname, `../../pug/etc/${template}.pug`)
  );

  const preprocessed = preprocess(data, SHORTFORM_DEFAULTS).results;
  const withRssValues = preprocessed.map((article) => {
    article.entryHtml = shortformPugTemplate({
      article,
    });

    article.rssSummary = makeSummary(article);
    if (!article.entryAdded) {
      if (article.week) {
        article.entryAdded = getMomentFromWeek(article.week).toISOString();
      } else if (article.started) {
        article.entryAdded = moment(article.started).toISOString();
      }
    } else {
      article.entryAdded = moment(article.entryAdded).toISOString();
    }

    return article;
  });
  withRssValues.sort(makeSortBySimpleDateKey('entryAdded'));
  const results = withRssValues.slice(0, 20);
  return results;
};

module.exports = getRssResults;
