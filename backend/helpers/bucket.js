import { Storage } from '@google-cloud/storage';
import axios from 'axios';
import { pipeline } from 'node:stream/promises';

import { getUniqueId } from '../../api/helpers/uniqueId.js';
import { USER_AGENT } from '../config/requests.js';
import { isProd } from '../env.js';

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
 * @param {{filename?: string}} [options] filename: the name to store it under, before the
 *   unique prefix (default: the last part of the URL's path)
 * @returns {Promise<{url: string, contentType: string}>}
 */
export async function copyUrlToBucket(url, { filename } = {}) {
  const response = await axios.get(url, {
    headers: { 'User-Agent': USER_AGENT },
    responseType: 'stream',
    timeout: 60000,
  });
  const contentType = response.headers['content-type'] || '';
  const name = safeFilename(
    filename || new URL(url).pathname.split('/').pop() || 'file',
  );
  await pipeline(
    response.data,
    uploadBucket.file(`${UPLOAD_FOLDER}/${name}`).createWriteStream({
      predefinedAcl: 'private',
      metadata: { contentType },
    }),
  );
  return { url: publicUrl(name), contentType };
}
