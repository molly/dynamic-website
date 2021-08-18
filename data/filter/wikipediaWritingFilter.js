const getLocalJson = require('../utils/getLocalJson');
const WIKIPEDIA_DEFAULTS = require('../wikipediaDefaults');
const { matches } = require('./filter');
const paginate = require('./paginate');
const moment = require('moment');

const { defaultArticle, topicText } = WIKIPEDIA_DEFAULTS;

const preprocess = (data, query) => {
  const processed = [];
  const topicsMap = {};
  for (let article of data) {
    const updatedArticle = { ...defaultArticle, ...article };

    // Date
    updatedArticle.date = moment(article.date, 'YYYY-MM');
    updatedArticle.formattedDate = updatedArticle.date.format('MMMM YYYY');

    // Topics
    updatedArticle.topics = updatedArticle.topics.map((topic) => ({
      text: Object.prototype.hasOwnProperty.call(topicText, topic)
        ? topicText[topic]
        : topic.replace(/_/g, ' '),
      value: topic,
    }));
    updatedArticle.topics.sort((a, b) =>
      a.text.toLowerCase().localeCompare(b.text.toLowerCase())
    );
    processed.push(updatedArticle);
    for (let topic of updatedArticle.topics) {
      if (Object.prototype.hasOwnProperty.call(topicsMap, topic.value)) {
        topicsMap[topic.value].frequency += 1;
      } else {
        topicsMap[topic.value] = { ...topic, frequency: 1 };
      }
    }
  }

  processed.sort((a, b) => {
    if (a.date.month() === b.date.month() && a.date.year() === b.date.year()) {
      const sortA = a.sortKey || a.title;
      const sortB = b.sortKey || b.title;
      return sortA.toLowerCase().localeCompare(sortB.toLowerCase());
    }
    if (a.date.isBefore(b.date)) {
      return query.order === 'reverse' ? -1 : 1;
    }
    return query.order === 'reverse' ? 1 : -1;
  });

  processed.forEach((p) => delete p.date);

  const allTopics = Object.values(topicsMap);
  allTopics.sort((a, b) =>
    a.text.toLowerCase().localeCompare(b.text.toLowerCase())
  );

  return { results: processed, allTopics };
};

const filter = ({ results }, req) => {
  let filteredResults = results.slice();
  if (req.query.tags) {
    const topics = req.query.tags.split('-');
    filteredResults = filteredResults.filter((article) =>
      article.topics.some((topic) => topics.includes(topic.value))
    );
  }
  if (req.query.created) {
    filteredResults = filteredResults.filter((article) => article.created);
  }
  if (req.query.bio) {
    filteredResults = filteredResults.filter((article) => article.biography);
  }
  if (req.query.wir) {
    filteredResults = filteredResults.filter((article) => article.WIR);
  }
  if (req.query.translation) {
    filteredResults = filteredResults.filter((article) => article.translation);
  }
  if (req.query.ga) {
    filteredResults = filteredResults.filter((article) => article.ga);
  }

  if (req.query.search) {
    const search = req.query.search.toLowerCase();
    filteredResults = filteredResults.filter((article) =>
      matches(article.title, search)
    );
  }

  return { results: filteredResults };
};

const getWikipediaWriting = async (req, paginationDefaults) => {
  const data = await getLocalJson('../wikipediaWriting.json');
  let resp = preprocess(data, req.query);
  resp = { ...resp, ...filter(resp, req) };
  resp = { ...resp, ...paginate(resp, req, paginationDefaults) };
  return { ...resp, totalUnfilteredResults: data.length };
};

module.exports = getWikipediaWriting;
