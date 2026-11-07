import express from 'express';
import multer from 'multer';

import {
  UPLOAD_FOLDER,
  copyUrlToBucket,
  publicUrl,
  safeFilename,
  uploadBucket,
} from '../helpers/bucket.js';
import { authenticated } from './auth.js';

const router = express.Router();

// Multer storage engine that streams uploaded files straight to the bucket.
const uploadHandler = multer({
  storage: {
    _handleFile(req, file, cb) {
      const filename = safeFilename(file.originalname);
      file.stream
        .pipe(
          uploadBucket.file(`${UPLOAD_FOLDER}/${filename}`).createWriteStream({
            predefinedAcl: 'private',
            metadata: { contentType: file.mimetype },
          }),
        )
        .on('error', cb)
        .on('finish', () => cb(null, { filename, contentType: file.mimetype }));
    },
    _removeFile(req, file, cb) {
      uploadBucket
        .file(`${UPLOAD_FOLDER}/${file.filename}`)
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
          url: publicUrl(req.file.filename),
          contentType: req.file.contentType,
        },
      });
    } catch (err) {
      console.error(err);
      res.sendStatus(500).send({ error: err });
    }
  },
);

// Upload remote file by URL.
router.post('/byURL', authenticated(), async (req, res) => {
  try {
    res.json({ success: 1, file: await copyUrlToBucket(req.body.url) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: 0, error: err.message });
  }
});

export default router;
