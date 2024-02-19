import express from 'express';
import authRouter from './auth.js';
import readingListRouter from './readingList.js';

const app = express.Router();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/', readingListRouter);
app.use('/auth', authRouter);

export default app;
