import { Storage } from '@google-cloud/storage';
import axios from 'axios';
import express from 'express';
import multer from 'multer';

import { getUniqueId } from '../../api/helpers/uniqueId.js';
import { USER_AGENT } from '../config/requests.js';

import { authenticated } from './auth.js';

const storage = new Storage();
const bucket = storage.bucket('storage.mollywhite.net');

const router = express.Router();

const uploadBucket = new Storage({
  keyFilename: new URL('../config/service-account.json', import.meta.url)
    .pathname,
  projectId: 'mollywhite',
}).bucket('storage.mollywhite.net');

// Multer storage engine that streams uploaded files straight to the bucket.
const uploadHandler = multer({
  storage: {
    _handleFile(req, file, cb) {
      const filename = `${getUniqueId(10)}_${file.originalname.replace(/[^a-zA-Z0-9_.]/g, '-')}`;
      file.stream
        .pipe(
          uploadBucket.file(`micro/${filename}`).createWriteStream({
            predefinedAcl: 'private',
            metadata: { contentType: file.mimetype },
          }),
        )
        .on('error', cb)
        .on('finish', () => cb(null, { filename, contentType: file.mimetype }));
    },
    _removeFile(req, file, cb) {
      uploadBucket
        .file(`micro/${file.filename}`)
        .delete({ ignoreNotFound: true })
        .then(() => cb(), cb);
    },
  },
});

// Upload local file by multipart form.
router.post(
  '/byFile',
  [authenticated(), uploadHandler.single('image')],
  (req, res) => {
    try {
      res.json({
        success: 1,
        file: {
          url: `https://storage.mollywhite.net/micro/${encodeURIComponent(req.file.filename)}`,
          contentType: req.file.contentType,
        },
      });
    } catch (err) {
      console.error(err);
      res.sendStatus(500).send({ error: err });
    }
  },
);

// Upload remote file by URL. Streams the file from the URL to the bucket.
router.post('/byURL', authenticated(), async (req, res) => {
  const originalFilename = req.body.url.split('/').pop();
  const targetFilename = `${getUniqueId(10)}_${originalFilename}`;
  const file = bucket.file(`micro/${targetFilename}`);
  const { data } = await axios.get(req.body.url, {
    headers: { 'User-Agent': USER_AGENT },
    decompress: false,
    responseType: 'stream',
  });
  data
    .pipe(file.createWriteStream())
    .on('error', function (err) {
      res.sendStatus(500).send({ error: err });
    })
    .on('finish', function () {
      res.json({
        success: 1,
        file: {
          url: `https://storage.mollywhite.net/micro/${encodeURIComponent(targetFilename)}`,
          contentType: data.headers['content-type'],
        },
      });
    });
});

export default router;
