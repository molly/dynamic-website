const moment = require('moment');

const preprocess = (data, { defaultArticle, tagText }) => {
  const processed = [];
  let allRawTags = new Set();
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
    updatedArticle.moment = m;
    updatedArticle.tags.sort();
    processed.push(updatedArticle);
    allRawTags = new Set([...allRawTags, ...updatedArticle.tags]);
  }

  const allTags = [...allRawTags].map((tag) => ({
    text: Object.prototype.hasOwnProperty.call(tagText, tag)
      ? tagText[tag]
      : tag.toLowerCase(),
    value: tag,
  }));

  return { results: processed, allTags };
};

module.exports = preprocess;
