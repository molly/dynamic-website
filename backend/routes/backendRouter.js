import cookieParser from 'cookie-parser';
import cookieSession from 'cookie-session';
import express from 'express';
import { ServerApiVersion } from 'mongodb';
import db from '../models/db.js';
import authRouter from './auth.js';
import readingListRouter from './readingList.js';

db.mongoose
  .connect(
    `mongodb+srv://reading-list:${process.env.PASSWORD}@cluster0.ptjwk.mongodb.net/reading-list?retryWrites=true&w=majority`,
    {
      serverApi: ServerApiVersion.v1,
    },
  )
  .then(() => {
    console.log('db connected');
  })
  .catch(() => {
    console.error('db connection error');
    process.exit();
  });

const app = express.Router();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cookieSession({
    name: 'reading-list-extension',
    secret: process.env.COOKIE_SESSION_SECRET,
  }),
);
app.use(cookieParser());

app.use('/', readingListRouter);
app.use('/auth', authRouter);

export default app;
