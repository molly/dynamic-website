import { createCanvas } from '@napi-rs/canvas';
import axios from 'axios';
import { createRequire } from 'node:module';
import path from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import sharp from 'sharp';

import { USER_AGENT } from '../config/requests.js';

// First-page thumbnails for document cards. The PDF is downloaded into memory, one page is drawn
// and saved as a small WebP, and the PDF itself is thrown away: only the thumbnail is stored.
// Rendering uses pdf.js with its prebuilt canvas, so the server needs no PDF tools installed.

export const THUMBNAIL_WIDTH = 360; // About 4x the card's 4.5em column; ~10–40 KB as WebP
export const MAX_PDF_BYTES = 60 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 60 * 1000;

// pdf.js's standard fonts and character maps, for PDFs that don't embed their fonts.
const pdfjsDir = path.dirname(
  createRequire(import.meta.url).resolve('pdfjs-dist/package.json'),
);
const STANDARD_FONTS = `${path.join(pdfjsDir, 'standard_fonts')}/`;
const CMAPS = `${path.join(pdfjsDir, 'cmaps')}/`;

export const isPdf = (buffer) =>
  buffer.length > 5 && buffer.subarray(0, 1024).includes('%PDF-');

/**
 * Download a PDF. Checks the bytes rather than the content type, which servers often get wrong.
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
export async function fetchPdf(url) {
  if (!/^https?:\/\//.test(url)) {
    throw new Error('That isn’t a web link.');
  }
  let data;
  try {
    ({ data } = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: FETCH_TIMEOUT_MS,
      maxContentLength: MAX_PDF_BYTES,
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/pdf,*/*' },
    }));
  } catch (err) {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const status = err.response?.status;
    throw new Error(
      status === 401 || status === 403
        ? `${host} refused to let the server download it (${status}); sites with bot protection do this.`
        : status
          ? `${host} returned an error (${status}).`
          : `Couldn’t download it from ${host}: ${err.message}`,
      { cause: err },
    );
  }
  const buffer = Buffer.from(data);
  if (!isPdf(buffer)) {
    throw new Error(
      'That link didn’t return a PDF (it may need a login or block downloads).',
    );
  }
  return buffer;
}

/**
 * Draw one page of a PDF as a WebP, THUMBNAIL_WIDTH pixels wide.
 * @param {Buffer|Uint8Array} pdf
 * @param {{page?: number, width?: number}} [options] page: 1-based; past the end means the last
 * @returns {Promise<Buffer>}
 */
export async function renderPdfPage(
  pdf,
  { page = 1, width = THUMBNAIL_WIDTH } = {},
) {
  const loading = getDocument({
    data: new Uint8Array(pdf), // pdf.js takes ownership of (and detaches) the array it's given
    standardFontDataUrl: STANDARD_FONTS,
    cMapUrl: CMAPS,
    cMapPacked: true,
    isEvalSupported: false,
    verbosity: 0,
  });
  try {
    const doc = await loading.promise;
    const pageNumber = Math.min(
      Math.max(1, Math.floor(page) || 1),
      doc.numPages,
    );
    const pdfPage = await doc.getPage(pageNumber);
    const unscaled = pdfPage.getViewport({ scale: 1 });
    const viewport = pdfPage.getViewport({ scale: width / unscaled.width });
    const canvas = createCanvas(
      Math.ceil(viewport.width),
      Math.ceil(viewport.height),
    );
    await pdfPage.render({
      canvas,
      canvasContext: canvas.getContext('2d'),
      viewport,
      background: 'white',
    }).promise;
    return sharp(await canvas.encode('png'))
      .webp({ quality: 80 })
      .toBuffer();
  } finally {
    await loading.destroy();
  }
}
