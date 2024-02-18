import express from 'express';

const router = express.Router();

router.get('/editor', (req, res) => {
  res.render('editor.pug');
});

export default router;
