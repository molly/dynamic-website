const moment = require('moment');
const path = require('path');
const pug = require('pug');

const getLocalJson = require('../utils/getLocalJson');
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
  const textOnlySummary = article.summary.replace(/(<([^>]+)>)/gi, '');
  const trimmedSummary = getSummaryExcerpt(textOnlySummary, 200);
  return summary + ' ' + trimmedSummary;
};

const getRssResults = async () => {
  const shortformPugTemplate = pug.compileFile(
    path.join(__dirname, '../../pug/etc/rssArticle.pug')
  );

  const shortform = await getLocalJson('../shortform.json');
  const preprocessed = preprocess(shortform, SHORTFORM_DEFAULTS).results;
  const withRssValues = preprocessed.map((article) => {
    article.entryHtml = shortformPugTemplate({
      article,
    });

    article.rssSummary = makeSummary(article);
    if (!article.entryAdded) {
      article.entryAdded = getMomentFromWeek(article.week).toISOString();
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
