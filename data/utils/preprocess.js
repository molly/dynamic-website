const moment = require('moment');

const preprocess = (data, { defaultArticle, tagText }) => {
  const processed = [];
  const tagsMap = {};
  for (let article of data) {
    const updatedArticle = { ...defaultArticle, ...article };
    const m = moment(updatedArticle.date, ['YYYY-MM-DD', 'YYYY-MM', 'YYYY']);
    if (m.year() !== 1970) {
      if (updatedArticle.date.match(/^\d{4}-\d{1,2}-\d{1,2}$/m)) {
        updatedArticle.formattedDate = m.format('MMMM D, YYYY');
      } else if (updatedArticle.date.match(/^\d{4}-\d{1,2}$/m)) {
        updatedArticle.formattedDate = m.format('MMMM YYYY');
      } else if (updatedArticle.date.match(/^\d{4}$/m)) {
        updatedArticle.formattedDate = m.year().toString();
      }
    }
    updatedArticle.tags = updatedArticle.tags.map((tag) =>
      Object.prototype.hasOwnProperty.call(tagText, tag)
        ? tagText[tag]
        : tag.replace('_', ' ')
    );
    updatedArticle.tags.sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
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
      : tag.replace('_', ' '),
    value: tag,
    frequency: tagsMap[tag],
  }));
  allTags.sort((a, b) =>
    a.text.toLowerCase().localeCompare(b.text.toLowerCase())
  );

  return { results: processed, allTags };
};

module.exports = preprocess;
