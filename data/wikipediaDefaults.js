const WIKIPEDIA_DEFAULTS = {
  title: null,
  italicTitle: false,
  sortKey: null,
  date: '1970-01-01',
  formattedDate: null,
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

const WIKIPEDIA_TOPICS = {
  american_left: 'American left',
  covid19: 'COVID-19',
  lgbtq: 'LGBTQ',
  massachusetts: 'Massachusetts',
  trans_nb: 'trans and non-binary people',
  women_in_stem: 'women in STEM',
};

export default {
  defaultArticle: WIKIPEDIA_DEFAULTS,
  topicText: WIKIPEDIA_TOPICS,
  defaultKey: 'WIKIPEDIA',
};
