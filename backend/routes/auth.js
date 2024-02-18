import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from '../models/db.js';
const User = db.User;
import config from '../config/auth.config.js';
import { verifyJwt } from '../middlewares/jwt.js';

const router = express.Router();

// router.post('/signup', (req, res) => {
//   const user = new User({
//     username: req.body.username,
//     password: bcrypt.hashSync(req.body.password, 8),
//   });
//   user.save((err) => {
//     if (err) {
//       return res.status(500).send({ message: err });
//     }
//     return res.send({ message: 'Registration successful' });
//   });
// });

router.post('/signin', (req, res) => {
  User.findOne({ username: req.body.username }).exec(async (err, user) => {
    if (err) {
      return res.status(500).send({ message: err });
    }
    if (!user) {
      return res.status(400).send({ message: 'User not found' });
    }

    const isValidPassword = bcrypt.compareSync(
      req.body.password,
      user.password,
    );

    if (!isValidPassword) {
      return res.status(401).send({ message: 'Invalid password' });
    }

    const accessToken = jwt.sign({ id: user._id }, config.secret, {
      expiresIn: config.tokenExpiry,
    });
    const refreshToken = await db.RefreshToken.createToken(user);

    res.status(200).send({
      id: user._id,
      username: user.username,
      accessToken,
      refreshToken,
    });
  });
});

router.post('/refresh', async (req, res) => {
  const requestToken = req.body.refreshToken;
  if (!requestToken) {
    return res.status(403).send({ message: 'Refresh token missing' });
  }
  try {
    const refreshToken = await RefreshToken.findOne({
      token: requestToken,
    });
    if (!refreshToken) {
      return res
        .status(403)
        .send({ message: 'Refresh token not found in database' });
    }
    if (RefreshToken.isExpiredOrInvalid(refreshToken.token)) {
      RefreshToken.findByIdAndRemove(refreshToken._id, {
        useFindAndModify: false,
      }).exec();
      return res.status(403).message({
        message: 'Refresh token expired or invalid. Please sign in again.',
      });
    }
    const accessToken = jwt.sign({ id: refreshToken.user }, config.secret, {
      expiresIn: config.tokenExpiry,
    });
    return res.send({ accessToken, refreshToken: refreshToken.token });
  } catch (err) {
    return res.status(500).send({ message: err });
  }
});

router.post('/isSignedIn', verifyJwt, (req, res) => {
  // verifyJwt will break if there's an error
  return res.status(204).send();
});

router.post('/signout', (req, res, next) => {
  try {
    req.session = null;
    return res.status(200).send({ message: 'Signed out' });
  } catch (err) {
    next(err);
  }
});

export default router;
