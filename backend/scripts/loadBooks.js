import { Book } from '../models/book.model.js';
import db from '../models/db.js';

async function loadBooks() {
  await db.initialize();

  const books = await Book.find();

  for (const book of books) {
    book.createdAt = new Date();
    book.updatedAt = new Date();
    await book.save();
  }

  await db.gracefulClose();
}

loadBooks();
