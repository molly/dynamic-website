const WIKIPEDIA_DEFAULTS = {
  title: null,
  sortKey: null,
  year: null,
  created: false,
  biography: false,
  WIR: false,
  topics: [],
  ga: null,
  dyk: null,
  description: null,
  translation: null,
  image: null,
};

const WIKIPEDIA_TOPICS = {};

module.exports = {
  defaultArticle: WIKIPEDIA_DEFAULTS,
  topicText: WIKIPEDIA_TOPICS,
  defaultKey: 'WIKIPEDIA',
};
