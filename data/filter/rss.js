const moment = require('moment');
const path = require('path');
const pug = require('pug');

const getLocalJson = require('../utils/getLocalJson');
const preprocess = require('./preprocess');
const { getMomentFromWeek } = require('../utils/weekUtils');
const { makeSortBySimpleDateKey } = require('../utils/dateUtils');

const DIB_DEFAULTS = require('../dibDefaults');

const getRssResults = async () => {
  const dibPugTemplate = pug.compileFile(
    path.join(__dirname, '../../pug/etc/rssDibArticle.pug')
  );

  const dib = await getLocalJson('../dib.json');
  const preprocessed = preprocess(dib, DIB_DEFAULTS).results;
  const withRssValues = preprocessed.map((article) => {
    article.entryHtml = dibPugTemplate({
      article,
    });
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
