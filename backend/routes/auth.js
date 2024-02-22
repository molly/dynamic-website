import express from 'express';
import passport from 'passport';

const router = express.Router();

export function authenticated({ redirectTo } = {}) {
  return (req, res, next) => {
    if (req.isAuthenticated()) {
      return next();
    } else if (redirectTo) {
      return res.redirect(redirectTo);
    }
    res.status(401).send({ message: 'Not authenticated' });
  };
}

// router.post('/signup', (req, res) => {
//   User.register(
//     new User({
//       username: req.body.username,
//     }),
//     req.body.password,
//     (err) => {
//       if (err) {
//         return res.status(500).send({ message: err });
//       }
//       return res.send({ message: 'Registration successful' });
//     },
//   );
// });

router.post(
  '/login',
  passport.authenticate('local', {
    failureRedirect: '/login?status=failed',
  }),
  function (req, res) {
    if (req.body.redirect) {
      return res.redirect(req.body.redirect);
    }
    return res.status(200).json({ username: req.body.username });
  },
);

router.post('/isSignedIn', function (req, res) {
  const isAuthenticated = req.isAuthenticated();
  res.status(200).send({ isAuthenticated });
});

router.post('/logout', function (req, res, next) {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.sendStatus(200);
  });
});

export default router;
