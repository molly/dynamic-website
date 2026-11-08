import { Storage } from '@google-cloud/storage';
import axios from 'axios';
import { pipeline } from 'node:stream/promises';

import { getUniqueId } from '../../api/helpers/uniqueId.js';
import { USER_AGENT } from '../config/requests.js';
import { isProd } from '../env.js';
import { imageCleaner } from './imageCleaning.js';
import { hasLightEdges } from './imageEdges.js';

// The storage bucket that holds uploaded and copied media.

// Dev uploads go to their own folder so they never mix with the live site's files.
export const UPLOAD_FOLDER = isProd ? 'micro' : 'dev/micro';

export const uploadBucket = new Storage({
  keyFilename: new URL('../config/service-account.json', import.meta.url)
    .pathname,
  projectId: 'mollywhite',
}).bucket('storage.mollywhite.net');

export const safeFilename = (name) =>
  `${getUniqueId(10)}_${String(name || 'file').replace(/[^a-zA-Z0-9_.]/g, '-')}`;

export const publicUrl = (filename) =>
  `https://storage.mollywhite.net/${UPLOAD_FOLDER}/${encodeURIComponent(filename)}`;

/**
 * Copy a file from the web into the bucket.
 * @param {string} url
 * @param {{filename?: string, clean?: boolean}} [options] filename: the name to store it under,
 *   before the unique prefix (default: the last part of the URL's path). clean: resize images and
 *   strip their metadata, as for uploads (imageCleaning.js); for files you add yourself, not for
 *   copies of other platforms' media, which are kept as they were served.
 *   accept: the kinds of file wanted ('image', 'video', 'audio'); anything else is refused before
 *   it's copied, so a link to the wrong thing doesn't leave a stray file in the bucket.
 * @returns {Promise<{url: string, contentType: string, lightEdges?: boolean}>} lightEdges: for a
 *   cleaned image, whether its edges are white (imageEdges.js)
 */
export async function copyUrlToBucket(
  url,
  { filename, clean = false, accept } = {},
) {
  const response = await axios.get(url, {
    headers: { 'User-Agent': USER_AGENT },
    responseType: 'stream',
    timeout: 60000,
  });
  const contentType = response.headers['content-type'] || '';
  let cleaner = null;
  try {
    const kind = contentType.split('/')[0].trim().toLowerCase();
    if (accept?.length && !accept.includes(kind)) {
      throw new Error(
        `That link is ${contentType ? `a ${contentType} file` : 'not a file'}, not ${accept.join(' or ')}.`,
      );
    }
    if (clean) {
      cleaner = imageCleaner(contentType);
    }
  } catch (err) {
    response.data.destroy();
    throw err;
  }
  const name = safeFilename(
    filename || new URL(url).pathname.split('/').pop() || 'file',
  );
  // Whether a cleaned image's edges are white, read as it streams through (imageEdges.js)
  const edges = cleaner
    ? hasLightEdges(cleaner.clone()).catch(() => undefined)
    : Promise.resolve(undefined);
  await pipeline(
    response.data,
    ...(cleaner ? [cleaner] : []),
    uploadBucket.file(`${UPLOAD_FOLDER}/${name}`).createWriteStream({
      predefinedAcl: 'private',
      metadata: { contentType },
    }),
  );
  return { url: publicUrl(name), contentType, lightEdges: await edges };
}
