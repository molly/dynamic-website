import axios from 'axios';

const UPLOAD_URL = '/dynamic-api/micro/image/byFile';
const UPLOAD_BY_URL = '/dynamic-api/micro/image/byURL';
const PDF_THUMBNAIL_URL = '/dynamic-api/micro/image/pdfThumbnail';
// Where uploads are served from (backend/helpers/bucket.js publicUrl)
const STORAGE_HOST = 'storage.mollywhite.net';

const EXTENSION_TYPES = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
};

// A stored file's type, from its name (stored files aren't fetched just to look)
function typeFromName(url) {
  const extension = new URL(url).pathname.split('.').pop().toLowerCase();
  return EXTENSION_TYPES[extension] || '';
}

/**
 * Use a file that's already online. One that's already uploaded is used as it is; one from
 * anywhere else is copied to the bucket first (and cleaned, if it's an image), so it can't
 * disappear from under the post.
 * @param {string} url
 * @param {{accept?: string[]}} [options] accept: the kinds of file wanted ('image', 'video',
 *   'audio'); a link to anything else is refused
 * @returns {Promise<{url: string, contentType: string}>}
 * @throws When it isn't a web address, isn't the kind of file wanted, or can't be copied
 */
export async function uploadUrl(url, { accept } = {}) {
  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error('That isn’t a link.');
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error('That isn’t a web link.');
  }
  if (parsed.hostname === STORAGE_HOST) {
    const contentType = typeFromName(parsed.href);
    const kind = contentType.split('/')[0];
    if (accept?.length && contentType && !accept.includes(kind)) {
      throw new Error(
        `That link is a ${kind} file, not ${accept.join(' or ')}.`,
      );
    }
    return { url: parsed.href, contentType };
  }
  try {
    const { data } = await axios.post(UPLOAD_BY_URL, {
      url: parsed.href,
      accept,
    });
    return data.file;
  } catch (err) {
    throw new Error(err.response?.data?.error || err.message);
  }
}

/**
 * Ask for the link to a file that's already online (e.g. one uploaded for another post), for the
 * "use a link" buttons beside the editor's upload buttons.
 * @param {{accept?: string[], label?: string}} [options] accept: as for uploadUrl; label: what's
 *   being added, for the question ("image", "screenshot", …)
 * @returns {Promise<?{url: string, contentType: string}>} Null if nothing was entered
 * @throws As uploadUrl
 */
export function chooseLinkedFile({ accept = ['image'], label = 'image' } = {}) {
  const url = window.prompt(
    `Link to the ${label} (one on ${STORAGE_HOST} is used as it is; any other is copied there):`,
  );
  if (!url?.trim()) {
    return Promise.resolve(null);
  }
  return uploadUrl(url, { accept });
}

/**
 * Upload a file to the bucket.
 * @param {File} file
 * @returns {Promise<{url: string, contentType: string}>}
 */
export async function uploadFile(file) {
  const form = new FormData();
  form.append('image', file); // The upload endpoint takes any file under this name
  try {
    const { data } = await axios.post(UPLOAD_URL, form);
    return data.file;
  } catch (err) {
    // The server says why (e.g. a HEIC photo it can't strip location data from)
    throw new Error(err.response?.data?.error || err.message);
  }
}

/**
 * Make a thumbnail from a page of a PDF that's online. Only the thumbnail is stored, not the PDF.
 * @param {string} url
 * @param {number} [page] 1-based
 * @returns {Promise<{url: string, contentType: string}>}
 */
export async function pdfThumbnail(url, page = 1) {
  try {
    const { data } = await axios.post(PDF_THUMBNAIL_URL, { url, page });
    return data.file;
  } catch (err) {
    // The server says why (e.g. the site wouldn't hand over the PDF)
    throw new Error(err.response?.data?.error || err.message);
  }
}

/**
 * Make a thumbnail from a page of a PDF on your computer, for sites that only let browsers
 * download. Only the thumbnail is stored.
 * @param {File} file
 * @param {number} [page] 1-based
 * @returns {Promise<{url: string, contentType: string}>}
 */
export async function pdfThumbnailFromFile(file, page = 1) {
  const form = new FormData();
  form.append('pdf', file);
  form.append('page', String(page));
  try {
    const { data } = await axios.post(`${PDF_THUMBNAIL_URL}/byFile`, form);
    return data.file;
  } catch (err) {
    throw new Error(err.response?.data?.error || err.message);
  }
}
