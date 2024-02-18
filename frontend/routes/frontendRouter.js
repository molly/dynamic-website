import express from 'express';
import pressRouter from './pressRouter.js';
import readingListRouter from './readingList.js';
import wikipediaRouter from './wikipediaRouter.js';

const app = express.Router();

app.use('/reading', readingListRouter);
app.use('/press', pressRouter);
app.use('/wikipedia-work', wikipediaRouter);

export default app;
