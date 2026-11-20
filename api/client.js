import { Book } from '../backend/models/book.model.js';
import { PressEntry, ShortformEntry } from '../backend/models/entry.model.js';
import {
  getAllTags,
  getTagsByFrequency,
  getTagsByValue,
} from '../backend/helpers/tagCache.js';
import { getLimit } from '../data/filter/paginate.js';
import { formatArticleDate } from '../data/filter/preprocess.js';

const makeTagMap = (tags) =>
  tags.reduce((acc, tag) => {
    const { _id, ...rest } = tag;
    acc[_id.toString()] = rest;
    return acc;
  }, {});

const getDocumentsCollection = (collection) => {
  switch (collection) {
    case 'shortform':
      return ShortformEntry;
    case 'press':
      return PressEntry;
    case 'books':
      return Book;
    default:
      return null;
  }
};

const makeQuery = async (req, book = false) => {
  const query = {};
  if (!req || !req.query) {
    return query;
  }
  if (req.query.tags) {
    const tagStrings = req.query.tags.split('-');
    const tags = await getTagsByValue(tagStrings, { book });
    const tagIds = [];
    for (const tag of tags) {
      tagIds.push(tag._id);
    }
    query.tags = { $in: tagIds };
  }
  if (req.query.status) {
    query.status = { $in: req.query.status.split('-') };
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
      'series',
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
  const dateKey = collection === 'shortform' ? 'started' : 'date';
  const sortOrder = req.query.order && req.query.order === 'reverse' ? 1 : -1;
  const query = await makeQuery(req);

  try {
    const documentsCollection = getDocumentsCollection(collection);

    const cursor = documentsCollection.find(query);

    // Sort, paginate
    cursor.sort({ [dateKey]: sortOrder });
    if (start) {
      cursor.skip(start);
    }
    cursor.limit(limit);

    const [entries, totalFilteredResults, tags, allTags] = await Promise.all([
      cursor.lean(),
      documentsCollection.countDocuments(query),
      getAllTags(),
      getTagsByFrequency(collection),
    ]);

    // Each entry's tags, by value, from the cached tags
    const tagsById = new Map(tags.map((tag) => [tag._id.toString(), tag]));
    const results = entries.map((entry) => ({
      ...entry,
      tags: (entry.tags || [])
        .map((id) => tagsById.get(id.toString()))
        .filter(Boolean)
        .sort((a, b) => a.value.localeCompare(b.value)),
    }));

    return {
      currentPage: page,
      pageSize: limit,
      results: formatResults(results, {}),
      totalPages: Math.ceil(totalFilteredResults / limit),
      totalResults: totalFilteredResults,
      allTags,
    };
  } catch (err) {
    console.log(err);
  }
};

const formatBookResults = (results) =>
  results.map((result) => {
    return {
      ...result,
      ...formatArticleDate(result),
    };
  });

export const getPaginatedAndFilteredBooksFromDb = async (
  collection,
  req,
  paginationDefaults,
) => {
  const limit = getLimit(req.query.limit, paginationDefaults);
  const page = req.query.page ? parseInt(req.query.page, 10) : 1;
  const start = (page - 1) * limit;
  const sortOrder = req.query.order && req.query.order === 'reverse' ? 1 : -1;
  const query = await makeQuery(req, true);
  const addedFilters = [];
  // Books not marked either way count as fiction, as they always have
  if (req.query.type === 'fiction') {
    addedFilters.push({ $match: { fiction: { $ne: false } } });
  } else if (req.query.type === 'nonfiction') {
    addedFilters.push({ $match: { fiction: false } });
  }

  try {
    const documentsCollection = getDocumentsCollection(collection);

    const resultsQuery = documentsCollection
      .aggregate([
        { $match: query },
        ...addedFilters,
        {
          $addFields: {
            sortValue: { $ifNull: ['$completed', '$started'] },
            statusPriority: {
              $cond: {
                if: { $eq: ['$status', 'currentlyReading'] },
                then: 1,
                else: 0,
              },
            },
          },
        },
        // Use $facet to run multiple pipelines
        {
          $facet: {
            metadata: [
              // Pipeline to count total results after filtering
              { $count: 'total' },
            ],
            data: [
              // Pipeline to sort and paginate the results
              {
                $sort: {
                  sortValue: sortOrder,
                  statusPriority: sortOrder,
                  createdAt: sortOrder,
                  entryAdded: sortOrder,
                },
              },
              { $skip: start || 0 },
              { $limit: limit },
            ],
          },
        },
        // Unwind the metadata facet and handle cases where no documents are matched
        {
          $unwind: {
            path: '$metadata',
            preserveNullAndEmptyArrays: true,
          },
        },
      ])
      .exec();
    const [queryResult, bookTags, allTags] = await Promise.all([
      resultsQuery,
      getAllTags({ book: true }),
      getTagsByFrequency('total', { book: true }),
    ]);

    const totalFilteredResults = queryResult[0]?.metadata?.total || 0;

    // Hydrate tags
    const allTagsMap = makeTagMap(bookTags);
    const results = (queryResult[0]?.data || []).map((result) => {
      return {
        ...result,
        tags: result.tags
          .map((tagId) => {
            return allTagsMap[tagId.toString()];
          })
          .filter(Boolean)
          .sort((a, b) => a.text.localeCompare(b.text)),
      };
    });

    return {
      currentPage: page,
      pageSize: limit,
      results: formatBookResults(results, {}),
      totalPages: Math.ceil(totalFilteredResults / limit),
      totalResults: totalFilteredResults,
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
    return { mostRecentShortform };
  } catch (err) {
    console.log(err);
  }
};

export const getRssReadingFromDb = async () => {
  const limit = 20;
  const [articleTags, bookTags] = await Promise.all([
    getAllTags(),
    getAllTags({ book: true }),
  ]);
  const articleTagMap = makeTagMap(articleTags);
  const bookTagMap = makeTagMap(bookTags);
  try {
    // Get entries
    const entries = await ShortformEntry.aggregate([
      // Get recent articles from 'shortform'
      {
        $addFields: {
          sortValue: '$entryAdded', // Ensure consistent sorting key
          type: { $literal: 'article' }, // Identify source
        },
      },
      { $sort: { entryAdded: -1 } },
      { $limit: limit },

      // Union with books collection
      {
        $unionWith: {
          coll: 'books',
          pipeline: [
            {
              $addFields: {
                sortValue: {
                  $dateFromString: {
                    dateString: { $ifNull: ['$completed', '$started'] }, // Convert string to Date
                    format: '%Y-%m-%d',
                  },
                },
                type: { $literal: 'book' }, // Identify source
              },
            },
            { $sort: { sortValue: -1 } },
            { $limit: limit },
          ],
        },
      },

      // Sort combined results and take top [limit]
      {
        $sort: { sortValue: -1 },
      },
      { $limit: limit },
    ]).exec();

    // Preprocess
    for (const article of entries) {
      const formattedDates = formatArticleDate(article);
      if (article.type === 'article') {
        article.tags = article.tags.map((tagId) => {
          return articleTagMap[tagId.toString()];
        });
      } else if (article.type === 'book') {
        article.tags = article.tags.map((tagId) => {
          return bookTagMap[tagId.toString()];
        });
      }
      Object.assign(article, formattedDates);
    }

    return entries;
  } catch (err) {
    console.log(err);
  }
};
