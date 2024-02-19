import express from 'express';
import { authenticated } from '../../backend/routes/auth.js';

const router = express.Router();

router.get('/login', (req, res) => {
  res.render('micro/login.pug');
});

router.get('/editor', authenticated, (req, res) => {
  res.render('micro/editor.pug');
});

export default router;
