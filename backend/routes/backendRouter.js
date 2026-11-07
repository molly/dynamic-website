import express from 'express';
import archiveRouter from './archive.js';
import authRouter from './auth.js';
import entityRouter from './entities.js';
import feedRouter from './feed.js';
import imageRouter from './images.js';
import microRouter from './micro.js';
import readingListRouter from './readingList.js';
import rssRouter from './rss.js';
import socialRouter from './social.js';
import threadRouter from './threads.js';

const app = express.Router();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', readingListRouter);
app.use('/auth', authRouter);
app.use('/micro', microRouter);
app.use('/micro/image', imageRouter);
app.use('/micro/social', socialRouter);
app.use('/feed', feedRouter);
app.use('/threads', threadRouter);
app.use('/entities', entityRouter);
app.use('/archive', archiveRouter);
app.use('/rss', rssRouter);

export default app;
