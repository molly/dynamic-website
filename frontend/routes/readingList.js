import express from 'express';
import {
  getPaginatedAndFilteredBooksFromDb,
  getPaginatedAndFilteredFromDb,
} from '../../api/client.js';
import { tagText } from '../../api/helpers/listFilters.js';
import { getReadingDetails } from '../../api/helpers/reading.js';
import {
  BOOK_STATUS_FILTERS,
  BOOK_TYPE_FILTERS,
  booksHref,
  bookRow,
  readingQuery,
  readingTags,
  shortformHref,
  shortformRow,
} from '../../api/helpers/readingList.js';
import { loadArchives } from '../../backend/helpers/postContext.js';
import getLandingPageSummary from '../../data/filter/landing.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const { mostRecentShortform, shortformCount, currentBooks, bookCount } =
    await getLandingPageSummary();
  res.render('reading.pug', {
    shortform: mostRecentShortform,
    // "read", "watched", "listened to"
    shortformVerb: mostRecentShortform
      ? getReadingDetails({ shortform: mostRecentShortform }).verb.toLowerCase()
      : null,
    shortformCount,
    currentBooks,
    bookCount,
  });
});

router.get('/shortform', async (req, res) => {
  const results = await getPaginatedAndFilteredFromDb('shortform', req);
  const query = readingQuery(req.query);
  const archived = await loadArchives(results.results.map((a) => a.href));
  const href = (filters) => shortformHref({ ...query, ...filters });
  res.render('shortform.pug', {
    query,
    rows: results.results.map((article) => shortformRow(article)),
    tags: readingTags(results.allTags, query.tags, {
      count: (tag) => tag.frequency?.shortform,
      href: (tags) => href({ tags, page: 1 }),
    }),
    archived,
    totalResults: results.totalResults,
    isFiltered: Boolean(query.tags.length || query.search),
    clearHref: shortformHref({ order: query.order }),
    newestHref: href({ order: '' }),
    oldestHref: href({ order: 'reverse' }),
    currentPage: results.currentPage,
    totalPages: results.totalPages,
    pageHref: (n) => href({ page: n }),
    tagHref: (tag) => shortformHref({ tags: [tag.value] }),
    tagText,
  });
});

router.get('/books', async (req, res) => {
  const results = await getPaginatedAndFilteredBooksFromDb('books', req, {
    default: 10,
  });
  const query = readingQuery(req.query);
  const href = (filters) => booksHref({ ...query, ...filters });
  res.render('books.pug', {
    query,
    rows: results.results.map((book) => bookRow(book)),
    tags: readingTags(results.allTags, query.tags, {
      count: (tag) => tag.frequency?.total,
      href: (tags) => href({ tags, page: 1 }),
    }),
    statusFilters: BOOK_STATUS_FILTERS.map((filter) => ({
      ...filter,
      current: filter.value === query.status,
      href: href({ status: filter.value, page: 1 }),
    })),
    typeFilters: BOOK_TYPE_FILTERS.map((filter) => ({
      ...filter,
      current: filter.value === query.type,
      href: href({ type: filter.value, page: 1 }),
    })),
    totalResults: results.totalResults,
    isFiltered: Boolean(
      query.tags.length || query.search || query.status || query.type,
    ),
    clearHref: booksHref({ order: query.order }),
    newestHref: href({ order: '' }),
    oldestHref: href({ order: 'reverse' }),
    currentPage: results.currentPage,
    totalPages: results.totalPages,
    pageHref: (n) => href({ page: n }),
    tagHref: (tag) => booksHref({ tags: [tag.value] }),
    tagText,
  });
});

// RSS ========================================================================
router.get('/feed.xml', (req, res) => {
  res.sendFile(new URL('../../rss/readingFeed.xml', import.meta.url).pathname);
});

export default router;
