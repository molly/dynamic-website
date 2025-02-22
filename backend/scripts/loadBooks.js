import getLocalJson from '../../data/utils/getLocalJson.js';
import { Book } from '../models/book.model.js';
import db from '../models/db.js';
import { BookTag } from '../models/tag.model.js';

async function loadBooks() {
  await db.initialize();

  const books = await getLocalJson('../books/nonFiction.json');

  const now = new Date();

  for (const book of books) {
    const existingBook = await Book.findOne({ title: book.title });
    if (existingBook) {
      console.log('skipping ' + book.title);
      continue;
    }
    let tagObjects = [];
    for (const tag of book.tags) {
      let tagObject = await BookTag.findOne({ value: tag });
      if (!tagObject) {
        tagObject = new BookTag({
          text: tag.replace('_', ' '),
          value: tag,
          frequency: {
            total: 0,
          },
        });
        const newTag = await tagObject.save();
        console.log('Created new tag:', newTag.value, newTag.text);
      } else {
        tagObject.frequency.total += 1;
        await tagObject.save();
      }
      tagObjects.push(tagObject);
    }

    if (book.status == 'shelved') {
      book.status = 'dnf';
    }
    if (book.targetArticles) {
      delete book.targetArticles;
    }
    book.fiction = false;

    const bookModel = new Book(book);
    bookModel.tags = tagObjects;
    bookModel.entryAdded = now;
    await bookModel.save();
    console.log('added ' + bookModel.title);
  }

  await db.gracefulClose();
}

loadBooks();
