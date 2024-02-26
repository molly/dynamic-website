import express from 'express';
import multer from 'multer';
import MulterGoogleCloudStorage from 'multer-cloud-storage';

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

router.post('/byURL', (req, res) => {});

export default router;
