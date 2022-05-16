const BLOCKCHAIN_DEFAULTS = {
  title: null,
  author: null,
  date: '1970-01-01',
  started: '1970-01-01',
  completed: null,
  status: 'read',
  formattedDate: null,
  formattedStarted: null,
  formattedCompleted: null,
  work: null,
  publisher: null,
  workItalics: true,
  preposition: null,
  parenthetical: null,
  href: null,
  tags: [],
  relatedReading: [],
  entryAdded: null,
};

const BLOCKCHAIN_TAGS = {
  bitcoin: 'Bitcoin',
  blockchain_cities: 'blockchain cities',
  ethereum: 'Ethereum',
  el_salvador: 'El Salvador',
};

module.exports = {
  defaultArticle: BLOCKCHAIN_DEFAULTS,
  tagText: BLOCKCHAIN_TAGS,
  defaultKey: 'BLOCKCHAIN',
};
