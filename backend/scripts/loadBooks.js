import readline from 'node:readline';
import { Book } from '../models/book.model.js';
import db from '../models/db.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(questionText) {
  return new Promise((resolve) => {
    rl.question(questionText, resolve);
  });
}

async function loadBooks() {
  await db.initialize();

  const books = await Book.find();

  for (const book of books) {
    console.log(book.title);
    const series = await ask('Series: ');
    const number = await ask('Number: ');
    const pages = await ask('Pages: ');

    if (series !== '') {
      book.series = series;
    }
    if (number !== '') {
      book.seriesNumber = parseInt(number);
    }
    if (pages !== '') {
      book.pages = parseInt(pages);
    }
    if (series !== '' || number !== '' || pages !== '') {
      await book.save();
    }
  }

  await db.gracefulClose();
}

loadBooks();
