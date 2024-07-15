import express from 'express';
import fs from 'fs';
import https from 'https';
import config from './backend/config/auth.config.js';

import db from './backend/models/db.js';
import backendRouter from './backend/routes/backendRouter.js';
import webmentionRouter from './backend/routes/webmentionRouter.js';
import frontendRouter from './frontend/routes/frontendRouter.js';

import connectMongoSession from 'connect-mongodb-session';
import session from 'express-session';
import passport from 'passport';
import LocalStrategy from 'passport-local';
import User from './backend/models/user.model.js';
import { toISOWithoutMillis, webmentionTimestamp } from './pug/js/toISO.js';

const PORT = process.env.PORT || 5001;

const app = express();

const MongoStore = connectMongoSession(session);
const sessionConfig = {
  secret: config.secret,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
  },
  resave: false,
  saveUninitialized: false,
  store: new MongoStore({
    uri: `mongodb+srv://reading-list:${process.env.PASSWORD}@cluster0.ptjwk.mongodb.net/auth?retryWrites=true&w=majority`,
    collection: 'sessions',
  }),
};

if (process.argv[2] === 'prod') {
  app.set('trust proxy', 1);
  sessionConfig.cookie.secure = true;
}

app.use(session(sessionConfig));

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(passport.initialize());
app.use(passport.session());

app.use('/static', express.static(new URL('dist', import.meta.url).pathname));

app.set('views', new URL('pug/views', import.meta.url).pathname);
app.set('view engine', new URL('pug', import.meta.url).pathname);
app.locals.toISOWithoutMillis = toISOWithoutMillis;
app.locals.webmentionTimestamp = webmentionTimestamp;

app.use('/dynamic-api', backendRouter);
app.use('/', frontendRouter);
app.use('/webmention', webmentionRouter);

db.initialize().then(() => {
  if (process.argv[2] === 'prod') {
    https
      .createServer(
        {
          key: fs.readFileSync(
            new URL(`${config.certPath}/privkey.pem`, import.meta.url),
          ),
          cert: fs.readFileSync(
            new URL(`${config.certPath}/cert.pem`, import.meta.url),
          ),
          ca: fs.readFileSync(
            new URL(`${config.certPath}/chain.pem`, import.meta.url),
          ),
        },
        app,
      )
      .listen(PORT);
  } else {
    app.listen(PORT);
  }

  process.on('SIGINT', db.gracefulClose).on('SIGTERM', db.gracefulClose);
});
