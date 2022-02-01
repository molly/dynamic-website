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
  twitter: 'Twitter',
  w3igg: 'Web3 is going just great',
  wikimedia_timeline: 'Wikimedia timeline',
  wikipedia: 'Wikipedia',
  wikipedia_arbitration: 'Wikipedia: arbitration',
  wikipedia_breaking_news: 'Wikipedia: breaking news',
  wikipedia_gender_gap: 'Wikipedia: gender gap',
};

module.exports = {
  defaultArticle: PRESS_DEFAULTS,
  tagText: PRESS_TAGS,
  defaultKey: 'PRESS',
};
