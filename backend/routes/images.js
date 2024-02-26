import { Storage } from '@google-cloud/storage';
import axios from 'axios';
import express from 'express';
import multer from 'multer';
import MulterGoogleCloudStorage from 'multer-cloud-storage';
import crypto from 'node:crypto';

const storage = new Storage();
const bucket = storage.bucket('storage.mollywhite.net');

const router = express.Router();

const uploadHandler = multer({
  storage: MulterGoogleCloudStorage.storageEngine({
    bucket: 'storage.mollywhite.net',
    destination: 'micro',
    keyFilename: new URL('../config/service-account.json', import.meta.url)
      .pathname,
    filename: (req, file, cb) =>
      cb(null, file.originalname.replace(/[^a-zA-Z0-9_.]/g, '-')),
    projectId: 'mollywhite',
  }),
});

// Upload local file by multipart form.
router.post('/byFile', uploadHandler.single('image'), (req, res) => {
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
});

// Upload remote file by URL. Streams the file from the URL to the bucket.
router.post('/byURL', async (req, res) => {
  const originalFilename = req.body.url.split('/').pop();
  const targetFilename = `${crypto.randomUUID()}_${originalFilename}`;
  const file = bucket.file(`micro/${targetFilename}`);
  const { data } = await axios.get(req.body.url, {
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
