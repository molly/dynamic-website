const BOOK_DEFAULTS = {
  title: null,
  subtitle: null,
  author: null,
  date: '1970-01-01',
  formattedDate: null,
  publisher: null,
  imageSrc: null,
  href: null,
  tags: [],
  status: 'to_read',
  started: '1970-01-01',
  formattedStarted: null,
  completed: null,
  formattedCompleted: null,
  targetArticles: [],
};

const BOOK_TAGS = {};

module.exports = {
  defaultArticle: BOOK_DEFAULTS,
  tagText: BOOK_TAGS,
  defaultKey: 'BOOK',
};
