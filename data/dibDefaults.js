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
  entryAdded: null,
};

const DIB_TAGS = {
  antiasian_racism: 'anti-Asian racism',
  antiblack_racism: 'anti-Black racism',
  antifascism: 'anti-fascism',
  childrens_rights: "children's rights",
  covid19: 'COVID-19',
  india: 'India',
  indigenous_rights: 'Indigenous rights',
  lgbt: 'LGBT',
  massachusetts: 'Massachusetts',
  workers_rights: "workers' rights",
};

module.exports = {
  defaultArticle: DIB_DEFAULTS,
  tagText: DIB_TAGS,
  defaultKey: 'DIB',
};
