import axios from 'axios';
import express from 'express';
import multer from 'multer';
import { pipeline } from 'node:stream';

import {
  UPLOAD_FOLDER,
  copyUrlToBucket,
  publicUrl,
  safeFilename,
  uploadBucket,
} from '../helpers/bucket.js';
import { archivedFileUrl } from '../helpers/archive.js';
import { USER_AGENT } from '../config/requests.js';
import { imageCleaner } from '../helpers/imageCleaning.js';
import { bufferHasLightEdges, hasLightEdges } from '../helpers/imageEdges.js';
import {
  MAX_PDF_BYTES,
  fetchPdf,
  isPdf,
  renderPdfPage,
} from '../helpers/pdfThumbnail.js';
import { findRecentCapture, waybackFileUrl } from '../../jobQueue/wayback.js';
import { authenticated } from './auth.js';

const router = express.Router();

// Multer storage engine that streams uploaded files to the bucket, cleaning images on the way
// (resized, turned upright and stripped of EXIF; see imageCleaning.js).
const uploadHandler = multer({
  storage: {
    _handleFile(req, file, cb) {
      let cleaner;
      try {
        cleaner = imageCleaner(file.mimetype);
      } catch (err) {
        file.stream.resume(); // Drain the upload so the request can finish
        cb(err);
        return;
      }
      const filename = safeFilename(file.originalname);
      // Whether its edges are white, read from the same image as it streams through
      const edges = cleaner
        ? hasLightEdges(cleaner.clone()).catch(() => undefined)
        : Promise.resolve(undefined);
      pipeline(
        file.stream,
        ...(cleaner ? [cleaner] : []),
        uploadBucket.file(`${UPLOAD_FOLDER}/${filename}`).createWriteStream({
          predefinedAcl: 'private',
          metadata: { contentType: file.mimetype },
        }),
        (err) =>
          err
            ? cb(err)
            : edges.then((lightEdges) =>
                cb(null, { filename, contentType: file.mimetype, lightEdges }),
              ),
      );
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
router.post('/byFile', authenticated(), (req, res) => {
  uploadHandler.single('image')(req, res, (err) => {
    if (err || !req.file) {
      if (err) {
        console.error('Upload failed:', err);
      }
      res
        .status(422)
        .json({ success: 0, error: err?.message || 'No file was uploaded.' });
      return;
    }
    res.json({
      success: 1,
      file: {
        url: publicUrl(req.file.filename),
        contentType: req.file.contentType,
        lightEdges: req.file.lightEdges,
      },
    });
  });
});

// Upload remote file by URL. `accept` (optional): the kinds of file wanted, e.g. ['image'].
const KINDS = ['image', 'video', 'audio'];
router.post('/byURL', authenticated(), async (req, res) => {
  try {
    const accept = Array.isArray(req.body.accept)
      ? req.body.accept.filter((kind) => KINDS.includes(kind))
      : undefined;
    res.json({
      success: 1,
      file: await copyUrlToBucket(req.body.url, { clean: true, accept }),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: 0, error: err.message });
  }
});

// Document card thumbnails, drawn from a page of the PDF. Only the thumbnail is stored; the PDF
// is only held in memory while it's drawn.

async function storeThumbnail(pdf, { name, page }) {
  const filename = safeFilename(
    `${String(name || '').replace(/\.pdf$/i, '') || 'document'}-page${page || 1}.webp`,
  );
  await uploadBucket
    .file(`${UPLOAD_FOLDER}/${filename}`)
    .save(await renderPdfPage(pdf, { page }), {
      predefinedAcl: 'private',
      metadata: {
        contentType: 'image/webp',
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });
  return { url: publicUrl(filename), contentType: 'image/webp' };
}

// The PDF from its link. If its site won't hand it over (bot protection, say), the Wayback
// Machine's copy is used instead: the one archived from the editor if there is one, otherwise any
// capture of it.
async function fetchPdfOrArchivedCopy(url) {
  try {
    return await fetchPdf(url);
  } catch (err) {
    let archived = await archivedFileUrl(url);
    if (!archived) {
      const capture = await findRecentCapture(url, {
        maxAgeDays: Infinity,
        mimetype: 'application/pdf',
      }).catch(() => null);
      archived = capture ? waybackFileUrl(capture.archiveUrl) : null;
    }
    if (!archived) {
      throw new Error(
        `${err.message} The Wayback Machine has no copy either. Download the PDF in your browser and use “from a downloaded PDF”.`,
      );
    }
    try {
      return await fetchPdf(archived);
    } catch (archiveErr) {
      throw new Error(
        `${err.message} The Wayback Machine's copy didn't work either (${archiveErr.message}). Download the PDF in your browser and use “from a downloaded PDF”.`,
      );
    }
  }
}

router.post('/pdfThumbnail', authenticated(), async (req, res) => {
  const { url, page } = req.body;
  try {
    const pdf = await fetchPdfOrArchivedCopy(url);
    res.json({
      success: 1,
      file: await storeThumbnail(pdf, {
        name: new URL(url).pathname.split('/').pop(),
        page,
      }),
    });
  } catch (err) {
    console.error('Failed to make a PDF thumbnail:', err.message);
    res.status(422).json({ success: 0, error: err.message });
  }
});

// The same from a PDF chosen on your computer, for sites that only let browsers download.
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_BYTES, files: 1 },
});
router.post('/pdfThumbnail/byFile', authenticated(), (req, res) => {
  pdfUpload.single('pdf')(req, res, async (uploadErr) => {
    try {
      if (uploadErr || !req.file) {
        throw uploadErr || new Error('No PDF was uploaded.');
      }
      if (!isPdf(req.file.buffer)) {
        throw new Error('That file isn’t a PDF.');
      }
      res.json({
        success: 1,
        file: await storeThumbnail(req.file.buffer, {
          name: req.file.originalname,
          page: req.body.page,
        }),
      });
    } catch (err) {
      console.error('Failed to make a PDF thumbnail:', err.message);
      res.status(422).json({ success: 0, error: err.message });
    }
  });
});

// Whether an image that's already online has white edges, for one added by its link without being
// uploaded or copied (one already in the bucket). See imageEdges.js.
router.get('/lightEdges', authenticated(), async (req, res) => {
  try {
    const { data } = await axios.get(String(req.query.url), {
      responseType: 'arraybuffer',
      timeout: 30000,
      maxContentLength: 30 * 1024 * 1024,
      headers: { 'User-Agent': USER_AGENT },
    });
    res.json({ lightEdges: await bufferHasLightEdges(Buffer.from(data)) });
  } catch (err) {
    res.status(422).json({ error: err.message });
  }
});

export default router;
