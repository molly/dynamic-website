import { Book } from '../../backend/models/book.model.js';
import { ShortformEntry } from '../../backend/models/entry.model.js';

/**
 * The books on the reading index: those being read now or, when there are none, the one most
 * recently finished.
 * @returns {Promise<{status: 'currentlyReading'|'read', books: Object[]}>}
 */
export const getCurrentlyReadingBooks = async () => {
  const reading = await Book.find({ status: 'currentlyReading' })
    .sort({ started: -1 })
    .lean();
  if (reading.length) {
    return { status: 'currentlyReading', books: reading };
  }
  const finished = await Book.findOne({ status: 'read' })
    .sort({ completed: -1 })
    .lean();
  return { status: 'read', books: finished ? [finished] : [] };
};

/** What the reading index (/reading) shows of each list. */
const getLandingPageSummary = async () => {
  const [mostRecentShortform, shortformCount, currentBooks, bookCount] =
    await Promise.all([
      ShortformEntry.findOne({}).sort({ started: -1 }).lean(),
      ShortformEntry.countDocuments(),
      getCurrentlyReadingBooks(),
      Book.countDocuments(),
    ]);
  return { mostRecentShortform, shortformCount, currentBooks, bookCount };
};

export default getLandingPageSummary;
