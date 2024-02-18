const express = require('express');
const cookieParser = require('cookie-parser');
const cookieSession = require('cookie-session');
const { ServerApiVersion } = require('mongodb');

const db = require('../models');

const authRouter = require('./auth');
const readingListRouter = require('./reading-list');

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

module.exports = app;
