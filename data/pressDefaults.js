const PRESS_DEFAULTS = {
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
};

const PRESS_TAGS = {};

module.exports = {
  defaultArticle: PRESS_DEFAULTS,
  tagText: PRESS_TAGS,
  defaultKey: 'PRESS',
};
