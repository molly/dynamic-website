import { getLandingPageEntriesFromDb } from '../../api/client.js';
import { Book } from '../../backend/models/book.model.js';
import { BookTag } from '../../backend/models/tag.model.js';
import { formatArticleDate } from './preprocess.js';

export const getCurrentlyReadingBooks = async () => {
  let books = await Book.find({ status: 'currentlyReading' })
    .populate({
      path: 'tags',
      model: BookTag,
    })
    .lean();
  if (books.length === 0) {
    books = await Book.findOne()
      .sort({ completed: -1 })
      .populate({ path: 'tags', model: BookTag })
      .lean();
  }
  return books.map((result) => ({
    ...result,
    ...formatArticleDate(result),
  }));
};

const getLandingPageSummary = async () => {
  const { mostRecentBlockchain, mostRecentShortform } =
    await getLandingPageEntriesFromDb();
  const currentlyReadingBooks = await getCurrentlyReadingBooks();

  return {
    mostRecentBlockchain,
    mostRecentShortform,
    currentlyReadingBooks,
  };
};

export default getLandingPageSummary;
