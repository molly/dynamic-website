const getLocalJson = require('../utils/getLocalJson');
const WIKIPEDIA_DEFAULTS = require('../wikipediaDefaults');
const { matches } = require('./filter');
const paginate = require('./paginate');

const { defaultArticle, topicText } = WIKIPEDIA_DEFAULTS;

const preprocess = (data) => {
  const processed = [];
  const topicsMap = {};
  for (let article of data) {
    const updatedArticle = { ...defaultArticle, ...article };

    // Topics
    updatedArticle.topics = updatedArticle.topics.map((topic) => ({
      text: Object.prototype.hasOwnProperty.call(topicText, topic)
        ? topicText[topic]
        : topic.replace('_', ' '),
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
    const sortA = a.sortKey || a.title;
    const sortB = b.sortKey || b.title;
    return sortA.toLowerCase().localeCompare(sortB.toLowerCase());
  });

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
  let resp = preprocess(data);
  resp = { ...resp, ...filter(resp, req) };
  resp = { ...resp, ...paginate(resp, req, paginationDefaults) };
  return { ...resp, totalUnfilteredResults: data.length };
};

module.exports = getWikipediaWriting;
