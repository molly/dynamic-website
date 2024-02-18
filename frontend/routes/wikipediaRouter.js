import express from 'express';
import getWikipediaWriting from '../../data/filter/wikipediaWritingFilter.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const results = await getWikipediaWriting(req, { default: 20 });
  const selectedTopics = req.query.tags ? req.query.tags.split('-') : [];
  res.render('wikipedia-writing.pug', {
    query: { ...req.query, topics: selectedTopics },
    ...results,
  });
});

export default router;
