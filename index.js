import express from 'express';
import fs from 'fs';
import https from 'https';
import config from './backend/config/auth.config.js';

import db from './backend/models/db.js';
import backendRouter from './backend/routes/backendRouter.js';
import frontendRouter from './frontend/routes/frontendRouter.js';

const PORT = process.env.PORT || 5001;

const app = express();

app.use('/static', express.static(new URL('js', import.meta.url).pathname));
app.use('/static', express.static(new URL('css', import.meta.url).pathname));

app.set('views', new URL('pug/views', import.meta.url).pathname);
app.set('view engine', new URL('pug', import.meta.url).pathname);

app.use('/', frontendRouter);
app.use('/dynamic-api', backendRouter);

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
