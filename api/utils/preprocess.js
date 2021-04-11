const moment = require('moment');

const preprocess = (data, { defaultArticle, tagText }) => {
  const processed = [];
  const tagsMap = {};
  for (let article of data) {
    const updatedArticle = { ...defaultArticle, ...article };
    const m = moment(updatedArticle.date);
    if (m.year() !== 1970) {
      if (updatedArticle.date.match(/^\d{4}-\d{1,2}-\d{1,2}$/m)) {
        updatedArticle.formattedDate = m.format('MMMM D, YYYY');
      } else if (updatedArticle.date.match(/^\d{4}-\d{1,2}$/m)) {
        updatedArticle.formattedDate = m.format('MMMM YYYY');
      }
    }
    updatedArticle.tags.sort();
    processed.push(updatedArticle);
    for (let tag of updatedArticle.tags) {
      if (Object.prototype.hasOwnProperty.call(tagsMap, tag)) {
        tagsMap[tag] += 1;
      } else {
        tagsMap[tag] = 1;
      }
    }
  }

  const allTags = Object.keys(tagsMap).map((tag) => ({
    text: Object.prototype.hasOwnProperty.call(tagText, tag)
      ? tagText[tag]
      : tag.toLowerCase(),
    value: tag,
    frequency: tagsMap[tag],
  }));

  return { results: processed, allTags };
};

module.exports = preprocess;
