const DIB_DEFAULTS = {
  title: null,
  author: null,
  date: '1970-01-01',
  formattedDate: null,
  work: null,
  publisher: null,
  workItalics: true,
  preposition: 'in',
  parenthetical: null,
  href: null,
  tags: [],
  summary: null,
  relatedReading: [],
  week: null,
};

const DIB_TAGS = {};

module.exports = {
  defaultArticle: DIB_DEFAULTS,
  tagText: DIB_TAGS,
};
