const SHORTFORM_DEFAULTS = {
  title: null,
  author: null,
  date: '1970-01-01',
  started: '1970-01-01',
  completed: null,
  formattedDate: null,
  formattedStarted: null,
  formattedCompleted: null,
  work: null,
  publisher: null,
  workItalics: true,
  preposition: 'in',
  parenthetical: null,
  href: null,
  tags: [],
  summary: null,
  relatedReading: [],
  entryAdded: null,
};

const SHORTFORM_TAGS = {
  antiasian_racism: 'anti-Asian racism',
  antiblack_racism: 'anti-Black racism',
  antifascism: 'anti-fascism',
  childrens_rights: "children's rights",
  covid19: 'COVID-19',
  india: 'India',
  indigenous_rights: 'Indigenous rights',
  israel_palestine_conflict: 'Israeli–Palestinian conflict',
  lgbt: 'LGBT',
  massachusetts: 'Massachusetts',
  workers_rights: "workers' rights",
};

module.exports = {
  defaultArticle: SHORTFORM_DEFAULTS,
  tagText: SHORTFORM_TAGS,
  defaultKey: 'SHORTFORM',
};
