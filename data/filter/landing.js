const moment = require('moment');
const getLocalJson = require('../utils/getLocalJson');
const { makeSortByWeek } = require('../utils/weekUtils');
const { makeSortBySimpleDateKey } = require('../utils/dateUtils');

const DIB_DEFAULTS = require('../dibDefaults');
const BOOK_DEFAULTS = require('../books/bookDefaults');

const processTags = (item, tagText) => {
  item.tags = item.tags.map((tag) => ({
    text: Object.prototype.hasOwnProperty.call(tagText, tag)
      ? tagText[tag]
      : tag.replace('_', ' '),
    value: tag,
  }));
  item.tags.sort((a, b) =>
    a.text.toLowerCase().localeCompare(b.text.toLowerCase())
  );
  return item;
};

const getBooksOfStatusSortedByStartDate = (books, status) => {
  // Get all books with this status and sort by start date
  const booksOfStatus = books.filter((book) => book.status === status);
  if (booksOfStatus.length) {
    if (booksOfStatus.length > 1) {
      booksOfStatus.sort(makeSortBySimpleDateKey('started'));
    }
    return booksOfStatus;
  }
  return [];
};

const getBooksToShow = (books) => {
  // Show most recent currently reading books
  const currentlyReading = getBooksOfStatusSortedByStartDate(
    books,
    'currentlyReading'
  );
  if (currentlyReading.length) {
    return currentlyReading;
  }

  // Show most recent reference books
  const reference = getBooksOfStatusSortedByStartDate(books, 'reference');
  if (reference.length) {
    return reference;
  }

  // Show most recently completed books if they were completed in the last month
  const read = books.filter((book) => book.status === 'read');
  if (read.length) {
    if (read.length > 1) {
      read.sort(makeSortBySimpleDateKey('completed'));
    }
    const mostRecentlyRead = read[0];
    if (
      moment(mostRecentlyRead.completed).isAfter(moment().subtract(1, 'month'))
    ) {
      return [mostRecentlyRead];
    }
  }

  // Show a random "to read" book
  const toRead = books.filter((book) => book.status === 'toRead');
  if (toRead.length) {
    if (toRead.length > 1) {
      // Show a random book on the "to read" list
      const featuredBookIndex = Math.floor(Math.random() * toRead.length);
      const featuredBook = toRead[featuredBookIndex];
      const otherBooks = toRead.slice();
      otherBooks.splice(featuredBookIndex, 1);
      return [featuredBook, ...otherBooks];
    }
    return toRead;
  }

  return [];
};

const getLandingPageSummary = async () => {
  const dib = await getLocalJson('../dib.json');
  const mostRecentDib = {
    ...DIB_DEFAULTS.defaultArticle,
    ...dib.sort(makeSortByWeek())[0],
  };

  const pleasure = await getLocalJson('../books/pleasure.json');
  const currentlyReadingPleasure = getBooksToShow(pleasure).map((book) =>
    processTags(book, BOOK_DEFAULTS.tagText)
  );

  const wikipedia = await getLocalJson('../books/wikipedia.json');
  const currentlyReadingWikipedia = getBooksToShow(wikipedia).map((book) =>
    processTags(book, BOOK_DEFAULTS.tagText)
  );

  const work = await getLocalJson('../books/work.json');
  const currentlyReadingWork = getBooksToShow(work).map((book) =>
    processTags(book, BOOK_DEFAULTS.tagText)
  );

  return {
    mostRecentDib,
    currentlyReadingPleasure,
    currentlyReadingWikipedia,
    currentlyReadingWork,
  };
};

module.exports = getLandingPageSummary;
