const { getLimit } = require('../data/filter/paginate');
const { formatArticleDate, getTags } = require('../data/filter/preprocess');
const db = require('../backend/models');

const getDocumentsCollection = (collection) => {
  switch (collection) {
    case 'shortform':
      return db.ShortformEntry;
    case 'blockchain':
      return db.BlockchainEntry;
    case 'press':
      return db.PressEntry;
    default:
      return null;
  }
};

const getTagsCollection = (collection) => {
  switch (collection) {
    case 'shortform':
      return db.ShortformTag;
    case 'blockchain':
      return db.BlockchainTag;
    case 'press':
      return db.PressTag;
    default:
      return null;
  }
};

const makeQuery = (req) => {
  const query = {};
  if (!req || !req.query) {
    return query;
  }
  if (req.query.tags) {
    const tags = req.query.tags.split('-');
    query.tags = { $in: tags };
  }
  if (req.query.search) {
    const escapedSearchQuery = req.query.search.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&',
    );
    const fields = ['title', 'author', 'work', 'publisher', 'summary'];
    query.$or = fields.map((field) => ({
      [field]: { $regex: escapedSearchQuery, $options: 'i' },
    }));
  }
  return query;
};

const formatResults = (results, defaultArticle, tagText) =>
  results.map((result) => {
    return {
      ...defaultArticle,
      ...result,
      ...formatArticleDate(result),
      tags: getTags(result, tagText),
    };
  });

const getTagsMap = (allTagsArray) => {
  return allTagsArray.reduce((acc, tag) => {
    acc[tag.value] = tag.text;
    return acc;
  }, {});
};

const getPaginatedAndFilteredFromDb = async (
  collection,
  req,
  paginationDefaults,
) => {
  const limit = getLimit(req.query.limit, paginationDefaults);
  const page = req.query.page ? parseInt(req.query.page, 10) : 1;
  const start = (page - 1) * limit;
  const dateKey = ['blockchain', 'shortform'].includes(collection)
    ? 'started'
    : 'date';
  const sortOrder = req.query.order && req.query.order === 'reverse' ? 1 : -1;
  const query = makeQuery(req);

  try {
    const documentsCollection = getDocumentsCollection(collection);
    const tagsCollection = getTagsCollection(collection);

    const allTags = await tagsCollection.find().lean();
    allTags.sort((a, b) =>
      a.text.toLowerCase().localeCompare(b.text.toLowerCase()),
    );
    const tagText = getTagsMap(allTags);

    const cursor = documentsCollection.find(query);

    // Sort, paginate
    cursor.sort({ [dateKey]: sortOrder });
    if (start) {
      cursor.skip(start);
    }
    cursor.limit(limit);

    const results = await cursor.lean();

    const totalFilteredResults =
      await documentsCollection.countDocuments(query);
    const totalUnfilteredResults = await documentsCollection.countDocuments();
    return {
      currentPage: page,
      pageSize: limit,
      results: formatResults(results, {}, tagText),
      totalPages: Math.ceil(totalFilteredResults / limit),
      totalResults: totalFilteredResults,
      totalUnfilteredResults,
      allTags,
    };
  } catch (err) {
    console.log(err);
  }
};

const getLandingPageEntriesFromDb = async () => {
  try {
    const mostRecentShortform = await db.ShortformEntry.findOne({}).sort({
      started: -1,
    });
    const mostRecentBlockchain = await db.BlockchainEntry.findOne({}).sort({
      started: -1,
    });
    return { mostRecentBlockchain, mostRecentShortform };
  } catch (err) {
    console.log(err);
  }
};

const getRssEntriesFromDb = async (collection) => {
  const limit = 20;
  try {
    // Get entries
    const documentsCollection = getDocumentsCollection(collection);
    const cursor = documentsCollection
      .find({})
      .sort({ entryAdded: -1 })
      .limit(limit);
    const results = await cursor.toArray();

    // Get tags
    const tagsCollection = db.collection(`${collection}Tags`);
    const allTags = await tagsCollection.find().toArray();
    const tagsMap = getTagsMap(allTags);

    // Preprocess
    for (const article of results) {
      const formattedDates = formatArticleDate(article);
      Object.assign(article, formattedDates);

      if ('tags' in article && article.tags.length) {
        for (const ind in article.tags) {
          const tagDetails = tagsMap[article.tags[ind]];
          article.tags[ind] = {
            value: article.tags[ind],
            text: tagDetails ? tagDetails.text : article.tags[ind],
          };
        }
      }
    }

    return results;
  } catch (err) {
    console.log(err);
  }
};

module.exports = {
  getPaginatedAndFilteredFromDb,
  getLandingPageEntriesFromDb,
  getRssEntriesFromDb,
};
