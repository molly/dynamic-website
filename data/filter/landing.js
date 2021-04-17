const getLocalJson = require('../utils/getLocalJson');
const { makeSortByWeek } = require('../utils/weekUtils');

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

const getLandingPageSummary = async () => {
  const dib = await getLocalJson('../dib.json');
  const mostRecentDib = {
    ...DIB_DEFAULTS.defaultArticle,
    ...dib.sort(makeSortByWeek())[0],
  };

  const pleasure = await getLocalJson('../books/pleasure.json');
  const currentlyReadingPleasure = pleasure
    .filter((book) => book.status === 'currentlyReading')
    .map((book) => processTags(book, BOOK_DEFAULTS.tagText));

  const wikipedia = await getLocalJson('../books/wikipedia.json');
  const currentlyReadingWikipedia = wikipedia
    .filter((book) => book.status === 'currentlyReading')
    .map((book) => processTags(book, BOOK_DEFAULTS.tagText));

  const work = await getLocalJson('../books/work.json');
  const currentlyReadingWork = work
    .filter((book) => book.status === 'currentlyReading')
    .map((book) => processTags(book, BOOK_DEFAULTS.tagText));

  return {
    mostRecentDib,
    currentlyReadingPleasure,
    currentlyReadingWikipedia,
    currentlyReadingWork,
  };
};

module.exports = getLandingPageSummary;
