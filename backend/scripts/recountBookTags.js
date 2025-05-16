import { Book } from '../models/book.model.js';
import db from '../models/db.js';
import { BookTag } from '../models/tag.model.js';

async function migrate() {
  await db.initialize();

  const tags = await BookTag.find();
  for (const tag of tags) {
    tag.frequency = {
      total: 0,
    };
    await tag.save();
  }

  const books = await Book.find().populate({
    path: 'tags',
    model: BookTag,
  });

  for (const book of books) {
    for (const tag of book.tags) {
      tag.frequency.total += 1;
      await tag.save();
    }
  }

  await db.gracefulClose();
  return;
}

migrate();
