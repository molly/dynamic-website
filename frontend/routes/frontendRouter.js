import express from 'express';
import feedRouter from './feedRouter.js';
import homeRouter from './homeRouter.js';
import microRouter from './microRouter.js';
import pressRouter from './pressRouter.js';
import readingListRouter from './readingList.js';

const app = express.Router();

app.use('/', homeRouter);
app.use('/reading', readingListRouter);
app.use('/press', pressRouter);
app.use('/micro', microRouter);
app.use('/feed', feedRouter);

export default app;
