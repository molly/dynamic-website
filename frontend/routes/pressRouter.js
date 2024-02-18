import express from 'express';
import { getPaginatedAndFilteredFromDb } from '../../api/client.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const results = await getPaginatedAndFilteredFromDb('press', req);
  const selectedTags = req.query.tags ? req.query.tags.split('-') : [];
  res.render('press.pug', {
    query: { ...req.query, tags: selectedTags },
    ...results,
  });
});

export default router;
