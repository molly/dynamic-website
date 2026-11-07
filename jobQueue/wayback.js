import axios from 'axios';
import { USER_AGENT } from '../backend/config/requests.js';

// Archiving links with the Wayback Machine, the same way w3igg-archiver/wayback.py does: use a
// capture from the last RECENT_DAYS if there is one, and only ask for a new one if not.

export const RECENT_DAYS = 30;
const CDX_URL = 'https://web.archive.org/cdx/search/cdx';
const SAVE_URL = 'https://web.archive.org/save/';

/**
 * The newest successful capture in a CDX response, if it's recent enough.
 * @param {Array<string[]>} rows CDX JSON output: a header row, then [timestamp, original] rows
 * @param {Date} [now]
 * @returns {?{archiveUrl: string, archivedAt: Date}}
 */
export function recentCaptureFromCdx(rows, now = new Date()) {
  if (!Array.isArray(rows) || rows.length < 2) {
    return null;
  }
  const [timestamp, original] = rows[rows.length - 1];
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(timestamp);
  if (!match) {
    return null;
  }
  const [, y, mo, d, h, mi, s] = match.map(Number);
  const archivedAt = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  if (now - archivedAt > RECENT_DAYS * 24 * 60 * 60 * 1000) {
    return null;
  }
  return {
    archiveUrl: `https://web.archive.org/web/${timestamp}/${original}`,
    archivedAt,
  };
}

/**
 * Look for a recent successful capture of a URL.
 * @param {string} url
 */
export async function findRecentCapture(url) {
  const { data } = await axios.get(CDX_URL, {
    params: {
      url,
      output: 'json',
      fl: 'timestamp,original',
      filter: 'statuscode:200',
      limit: -1, // The newest capture only
    },
    headers: { 'User-Agent': USER_AGENT },
    timeout: 30000,
  });
  return recentCaptureFromCdx(data);
}

/**
 * Ask the Wayback Machine for a new capture. Slow: it loads the page before responding.
 * @param {string} url
 * @returns {Promise<{archiveUrl: string, archivedAt: Date}>}
 */
export async function savePageNow(url) {
  const response = await axios.get(`${SAVE_URL}${url}`, {
    headers: { 'User-Agent': USER_AGENT },
    timeout: 180000,
    maxRedirects: 5,
  });
  // The save endpoint ends on the new capture; its address is where the redirects landed.
  const finalUrl =
    response.request?.res?.responseUrl ||
    response.headers['content-location'] ||
    '';
  const archiveUrl = finalUrl.startsWith('/')
    ? `https://web.archive.org${finalUrl}`
    : finalUrl;
  if (!/^https:\/\/web\.archive\.org\/web\/\d{14}/.test(archiveUrl)) {
    throw new Error(
      `Save Page Now didn't return a capture (got "${archiveUrl}")`,
    );
  }
  return { archiveUrl, archivedAt: new Date() };
}
