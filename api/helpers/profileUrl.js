// Turn a pasted profile URL or handle into an entity account ({ network, handle }), for the
// new-entity dialog's "paste URL or handle" box. Returns null when the network can't be told.

const HOST_NETWORKS = [
  { hosts: ['bsky.app'], network: 'bluesky', pattern: /^\/profile\/([^/]+)/ },
  {
    hosts: ['twitter.com', 'x.com', 'mobile.twitter.com'],
    network: 'twitter',
    pattern: /^\/@?([A-Za-z0-9_]+)\/?$/,
  },
  {
    hosts: ['threads.net', 'threads.com'],
    network: 'threads',
    pattern: /^\/@([^/]+)/,
  },
  { hosts: ['tiktok.com'], network: 'tiktok', pattern: /^\/@([^/]+)/ },
  {
    hosts: ['youtube.com'],
    network: 'youtube',
    pattern: /^\/(?:@([^/]+)|channel\/([^/]+))/,
  },
];

/**
 * @param {string} text A profile URL or handle
 * @returns {{network: string, handle: string}|null}
 */
export function parseProfileUrl(text) {
  const value = text.trim();
  if (!value) {
    return null;
  }

  // @user@instance is a Mastodon handle
  const fediverse = value.match(
    /^@?([A-Za-z0-9_.]+)@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/i,
  );
  if (fediverse) {
    return {
      network: 'mastodon',
      handle: `${fediverse[1]}@${fediverse[2].toLowerCase()}`,
    };
  }

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  if (!url.hostname.includes('.')) {
    return null; // A bare word, not a URL
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const path = decodeURIComponent(url.pathname);

  // A Wikipedia article is about someone, not an account of theirs (see wikipedia.js)
  if (host === 'wikipedia.org' || host.endsWith('.wikipedia.org')) {
    return null;
  }

  for (const { hosts, network, pattern } of HOST_NETWORKS) {
    if (hosts.includes(host)) {
      const match = path.match(pattern);
      const handle = match && (match[1] || match[2]);
      return handle ? { network, handle } : null;
    }
  }

  // instance.example/@user is a Mastodon profile on any other host
  const mastodon = path.match(/^\/@([A-Za-z0-9_.]+)\/?$/);
  if (mastodon) {
    return { network: 'mastodon', handle: `${mastodon[1]}@${host}` };
  }

  // Anything else that was typed as a URL is a website
  if (/^https?:\/\//i.test(value)) {
    return { network: 'website', handle: url.href };
  }
  return null;
}
