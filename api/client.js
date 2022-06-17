const { MongoClient, ServerApiVersion } = require('mongodb');
const { getLimit } = require('../data/filter/paginate');

const uri = `mongodb+srv://reading-list:${process.env.PASSWORD}@cluster0.ptjwk.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const makeQuery = (req) => {
  const query = {};
  if (req.query.tags) {
    const tags = req.query.tags.split('-');
    query.tags = { $in: tags };
  }
  return query;
};

const searchedResults = () => {};

const getPaginatedAndFilteredFromDb = async (
  collection,
  defaults,
  req,
  paginationDefaults
) => {
  const limit = getLimit(req.query.limit, paginationDefaults);
  const page = req.query.page ? parseInt(req.query.page, 10) : 1;
  const start = (page - 1) * limit;
  const dateKey = collection === 'blockchain' ? 'started' : 'date';
  const sortOrder = req.query.order && req.query.order === 'reverse' ? -1 : 1;
  const query = makeQuery(req);

  try {
    await client.connect();
    const db = client.db('reading-list');
    const documentsCollection = db.collection(collection);
    const tagsCollection = db.collection(`${collection}Tags`);

    const allTags = await tagsCollection.find().toArray();
    allTags.sort((a, b) =>
      a.text.toLowerCase().localeCompare(b.text.toLowerCase())
    );

    const cursor = documentsCollection.find(query);

    if (req.query.search) {
      // Hand off to search helper
      const results = await cursor.toArray();
      return searchedResults(results);
    }

    // Sort, paginate
    cursor.sort({ [dateKey]: sortOrder });
    if (start) {
      cursor.skip(start);
    }
    cursor.limit(limit);

    const results = await cursor.toArray();

    if (req.query.search) {
      return searchedResults(results);
    } else {
      const totalFilteredResults = await documentsCollection.countDocuments(
        query
      );
      const totalUnfilteredResults = await documentsCollection.countDocuments();

      return {
        currentPage: page,
        pageSize: limit,
        results,
        totalPages: Math.ceil(totalFilteredResults / limit),
        totalResults: totalFilteredResults,
        totalUnfilteredResults,
        allTags,
      };
    }
  } catch (err) {
    console.log(err);
  } finally {
    await client.close();
  }
};

module.exports = { getPaginatedAndFilteredFromDb };
