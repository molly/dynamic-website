import axios from 'axios';

const UPLOAD_URL = '/dynamic-api/micro/image/byFile';

/**
 * Upload a file to the bucket.
 * @param {File} file
 * @returns {Promise<{url: string, contentType: string}>}
 */
export async function uploadFile(file) {
  const form = new FormData();
  form.append('image', file); // The upload endpoint takes any file under this name
  const { data } = await axios.post(UPLOAD_URL, form);
  return data.file;
}
