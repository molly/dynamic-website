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

const preprocess = (data, { defaultArticle, tagText, defaultKey }) => {
  const processed = [];
  const tagsMap = {};
  for (let article of data) {
    const updatedArticle = { ...defaultArticle, ...article };
    const m = moment(updatedArticle.date, ['YYYY-MM-DD', 'YYYY-MM', 'YYYY']);

    // Dates
    updatedArticle.formattedDate = formatDate(m, updatedArticle.date);
    if (defaultKey === 'BOOK' || defaultKey === 'BLOCKCHAIN') {
      if (article.started) {
        const startedMoment = moment(updatedArticle.started, [
          'YYYY-MM-DD',
          'YYYY-MM',
          'YYYY',
        ]);
        updatedArticle.formattedStarted = formatDate(
          startedMoment,
          updatedArticle.started
        );
      }
      if (updatedArticle.completed) {
        const completedMoment = moment(updatedArticle.completed, [
          'YYYY-MM-DD',
          'YYYY-MM',
          'YYYY',
        ]);
        updatedArticle.formattedCompleted = formatDate(
          completedMoment,
          updatedArticle.completed
        );
      }
    }

    // Tags
    updatedArticle.tags = updatedArticle.tags.map((tag) => ({
      text: Object.prototype.hasOwnProperty.call(tagText, tag)
        ? tagText[tag]
        : tag.replace(/_/g, ' '),
      value: tag,
    }));
    updatedArticle.tags.sort((a, b) =>
      a.text.toLowerCase().localeCompare(b.text.toLowerCase())
    );
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

module.exports = preprocess;
