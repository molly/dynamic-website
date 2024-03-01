import express from 'express';
import authRouter from './auth.js';
import feedRouter from './feed.js';
import imageRouter from './images.js';
import microRouter from './micro.js';
import readingListRouter from './readingList.js';

const app = express.Router();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', readingListRouter);
app.use('/auth', authRouter);

if (process.argv[2] !== 'prod') {
  // Feature flag
  app.use('/micro', microRouter);
  app.use('/micro/image', imageRouter);
}
app.use('/feed', feedRouter);

export default app;
