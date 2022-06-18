const moment = require('moment');

const formatDate = (dateMoment, rawDate) => {
  if (dateMoment.year() !== 1970) {
    if (rawDate.match(/^\d{4}-\d{1,2}-\d{1,2}$/m)) {
      return dateMoment.format('MMMM D, YYYY');
    } else if (rawDate.match(/^\d{4}-\d{1,2}$/m)) {
      return dateMoment.format('MMMM YYYY');
    } else if (rawDate.match(/^\d{4}$/m)) {
      return dateMoment.year().toString();
    }
    return null;
  }
};

const formatArticleDate = (article) => {
  const dates = {};
  if (article.date) {
    const m = moment(article.date, ['YYYY-MM-DD', 'YYYY-MM', 'YYYY']);
    dates.formattedDate = formatDate(m, article.date);
  }
  if (article.started) {
    const startedMoment = moment(article.started, [
      'YYYY-MM-DD',
      'YYYY-MM',
      'YYYY',
    ]);
    dates.formattedStarted = formatDate(startedMoment, article.started);
  }
  if (article.completed) {
    const completedMoment = moment(article.completed, [
      'YYYY-MM-DD',
      'YYYY-MM',
      'YYYY',
    ]);
    dates.formattedCompleted = formatDate(completedMoment, article.completed);
  }
  return dates;
};

const getTags = (article, tagText) => {
  if (!article.tags || !article.tags.length) {
    return [];
  }
  const tags = article.tags.map((tag) => ({
    text: Object.prototype.hasOwnProperty.call(tagText, tag)
      ? tagText[tag]
      : tag.replace(/_/g, ' '),
    value: tag,
  }));
  tags.sort((a, b) => a.text.toLowerCase().localeCompare(b.text.toLowerCase()));
  return tags;
};

const preprocess = (data, { defaultArticle, tagText }) => {
  const processed = [];
  const tagsMap = {};
  for (let article of data) {
    let updatedArticle = { ...defaultArticle, ...article };

    // Dates
    const formattedDates = formatArticleDate(updatedArticle);
    Object.assign(updatedArticle, formattedDates);

    // Tags
    updatedArticle.tags = getTags(updatedArticle, tagText);

    processed.push(updatedArticle);
    for (let tag of updatedArticle.tags) {
      if (Object.prototype.hasOwnProperty.call(tagsMap, tag.value)) {
        tagsMap[tag.value].frequency += 1;
      } else {
        tagsMap[tag.value] = { ...tag, frequency: 1 };
      }
    }
  }

  const allTags = Object.values(tagsMap);
  allTags.sort((a, b) =>
    a.text.toLowerCase().localeCompare(b.text.toLowerCase())
  );

  return { results: processed, allTags };
};

module.exports = { preprocess, formatArticleDate, getTags };
