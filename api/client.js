import {
  BlockchainEntry,
  PressEntry,
  ShortformEntry,
} from '../backend/models/entry.model.js';
import { Tag } from '../backend/models/tag.model.js';
import { getLimit } from '../data/filter/paginate.js';
import { formatArticleDate } from '../data/filter/preprocess.js';

const getDocumentsCollection = (collection) => {
  switch (collection) {
    case 'shortform':
      return ShortformEntry;
    case 'blockchain':
      return BlockchainEntry;
    case 'press':
      return PressEntry;
    default:
      return null;
  }
};

const makeQuery = async (req) => {
  const query = {};
  if (!req || !req.query) {
    return query;
  }
  if (req.query.tags) {
    const tagStrings = req.query.tags.split('-');
    const tags = await Tag.find({ value: { $in: tagStrings } });
    const tagIds = [];
    for (const tag of tags) {
      tagIds.push(tag._id);
    }
    query.tags = { $in: tagIds };
  }
  if (req.query.search) {
    const escapedSearchQuery = req.query.search.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&',
    );
    const fields = [
      'title',
      'author',
      'work',
      'publisher',
      'summary',
      'parenthetical',
    ];
    query.$or = fields.map((field) => ({
      [field]: { $regex: escapedSearchQuery, $options: 'i' },
    }));
  }
  return query;
};

const formatResults = (results, defaultArticle) =>
  results.map((result) => {
    return {
      ...defaultArticle,
      ...result,
      ...formatArticleDate(result),
    };
  });

export const getPaginatedAndFilteredFromDb = async (
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
  const query = await makeQuery(req);

  try {
    const documentsCollection = getDocumentsCollection(collection);

    const allTags = await Tag.find({
      [`frequency.${collection}`]: { $gt: 0 },
    }).lean();
    allTags.sort((a, b) =>
      a.text.toLowerCase().localeCompare(b.text.toLowerCase()),
    );

    const cursor = documentsCollection
      .find(query)
      .populate({ path: 'tags', model: Tag, options: { sort: { value: 1 } } });

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
      results: formatResults(results, {}),
      totalPages: Math.ceil(totalFilteredResults / limit),
      totalResults: totalFilteredResults,
      totalUnfilteredResults,
      allTags,
    };
  } catch (err) {
    console.log(err);
  }
};

export const getLandingPageEntriesFromDb = async () => {
  try {
    const mostRecentShortform = await ShortformEntry.findOne({}).sort({
      started: -1,
    });
    const mostRecentBlockchain = await BlockchainEntry.findOne({}).sort({
      started: -1,
    });
    return { mostRecentBlockchain, mostRecentShortform };
  } catch (err) {
    console.log(err);
  }
};

export const getRssEntriesFromDb = async (collection) => {
  const limit = 20;
  try {
    // Get entries
    const documentsCollection = getDocumentsCollection(collection);
    const cursor = documentsCollection
      .find({})
      .sort({ entryAdded: -1 })
      .limit(limit);
    const results = await cursor.lean();

    // Preprocess
    for (const article of results) {
      const formattedDates = formatArticleDate(article);
      Object.assign(article, formattedDates);
    }

    return results;
  } catch (err) {
    console.log(err);
  }
};
