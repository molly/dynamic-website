// Tell which network a link to a single post is on, and pull out what's needed to fetch it.
// Used for "in reply to" and the social post block, along with a few small link helpers for them.

/**
 * A URL's host without "www.", or '' if it isn't a URL.
 * @param {string} url
 */
export function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * A Twitter account's profile link. With the account's permanent user ID it keeps working after the
 * account is renamed; without one, the handle has to do.
 * @param {{accountId?: string, handle?: string}} account
 */
export function twitterProfileUrl({ accountId, handle }) {
  if (accountId) {
    return `https://twitter.com/i/user/${accountId}`;
  }
  return handle ? `https://twitter.com/${handle}` : '';
}

/**
 * @param {string} text A post URL
 * @returns {null|{network: 'bluesky', handle: string, rkey: string}
 *   |{network: 'mastodon', host: string, handle: string, id: string}
 *   |{network: 'twitter', handle: string, id: string}}
 */
export function parsePostUrl(text) {
  let url;
  try {
    url = new URL(String(text || '').trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol)) {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '');
  const path = url.pathname;

  if (host === 'bsky.app') {
    const match = path.match(/^\/profile\/([^/]+)\/post\/([^/]+)\/?$/);
    return match
      ? {
          network: 'bluesky',
          handle: decodeURIComponent(match[1]),
          rkey: match[2],
        }
      : null;
  }
  if (['twitter.com', 'x.com', 'mobile.twitter.com'].includes(host)) {
    const match = path.match(/^\/([A-Za-z0-9_]+)\/status\/(\d+)/);
    return match
      ? { network: 'twitter', handle: match[1], id: match[2] }
      : null;
  }
  // Mastodon and compatible servers: /@user/123 or, for a remote account, /@user@server/123
  const mastodon = path.match(
    /^\/@([A-Za-z0-9_.]+(?:@[a-z0-9.-]+)?)\/(\d+)\/?$/i,
  );
  if (mastodon) {
    return { network: 'mastodon', host, handle: mastodon[1], id: mastodon[2] };
  }
  return null;
}
