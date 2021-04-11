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

const PRESS_TAGS = {
  ARBITRATION: 'arbitration',
  BREAKING_NEWS: 'breaking news',
  DISINFORMATION: 'disinformation',
  GENDER_GAP: 'gender gap',
  HARASSMENT: 'harassment',
  TECHNOLOGY: 'technology',
  TWITTER: 'twitter',
  WIKIPEDIA: 'wikipedia',
};

module.exports = {
  defaultArticle: PRESS_DEFAULTS,
  tagText: PRESS_TAGS,
};
