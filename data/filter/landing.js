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

const getBooksToShow = (books) => {
  const currentlyReading = books.filter(
    (book) => book.status === 'currentlyReading'
  );
  if (currentlyReading.length) {
    if (currentlyReading.length > 1) {
      currentlyReading.sort(makeSortBySimpleDateKey('started'));
    }
    return currentlyReading;
  }

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
