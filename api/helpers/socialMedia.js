export const NETWORKS = [
  'twitter',
  'mastodon',
  'bluesky',
  'threads',
  'tiktok',
  'youtube',
];
// An entity's accounts: its website and its social accounts. (A Wikipedia article is about the
// entity, not an account of theirs: it's `ids.wikipedia`, see wikipedia.js.)
export const MENTION_NETWORKS = ['website', ...NETWORKS];

// How each network is named in the admin and editor.
export const NETWORK_LABELS = {
  website: 'Website',
  twitter: 'Twitter',
  mastodon: 'Mastodon',
  bluesky: 'Bluesky',
  threads: 'Threads',
  tiktok: 'TikTok',
  youtube: 'YouTube',
};

const SOCIAL_PREFIXES = {
  twitter: 'https://twitter.com/molly0xFFF/status/',
  mastodon: 'https://hachyderm.io/@molly0xfff/',
  bluesky: 'https://bsky.app/profile/molly.wiki/post/',
  threads: 'https://www.threads.net/@molly0xfff/post/',
  tiktok: 'https://www.tiktok.com/@molly0xfff/',
  youtube: 'https://www.youtube.com/watch?v=',
};

// For linking to other users' profiles
export const GENERIC_SOCIAL_PREFIXES = {
  twitter: 'https://twitter.com/',
  bluesky: 'https://bsky.app/profile/',
  tiktok: 'https://www.tiktok.com/@',
  threads: 'https://www.threads.net/@',
  youtube: 'https://www.youtube.com/channel/',
};

export function hydrateAndSortSocialLinks(links) {
  const order = [
    'twitter',
    'mastodon',
    'bluesky',
    'threads',
    'tiktok',
    'youtube',
  ];
  links.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  for (const link of links) {
    if (link.postId.startsWith('https://')) {
      // Already a full URL, no need to modify
      link.href = link.postId;
    } else {
      link.href = `${SOCIAL_PREFIXES[link.type]}${link.postId}`;
    }
  }
  return links;
}

export function getSocialLinkFromHandle(handle, network) {
  // Remove leading @, whitespace from ends
  const strippedHandle = handle.replace(/^@/, '').trim();
  if (network === 'mastodon') {
    // Link to home instance, rather than passing all through hachyderm/etc
    try {
      const match = /^([^@]+)@(.*)$/.exec(strippedHandle);
      return `https://${match[2]}/@${match[1]}`;
    } catch {
      return `https://hachyderm.io/${handle}`;
    }
  } else if (network === 'youtube' && handle.startsWith('@')) {
    // @ suggests this is a custom name, not a channel ID
    return `https://www.youtube.com/${handle}`;
  } else if (network === 'website') {
    return handle;
  }
  return `${GENERIC_SOCIAL_PREFIXES[network]}${strippedHandle}`;
}

// Characters that don't show but break links: zero-width spaces and joiners, direction marks and
// embeddings (often carried along when a handle is copied from a profile), and byte order marks
const INVISIBLE =
  /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

/**
 * An account handle cleaned of mistakes that break its link: invisible characters, surrounding
 * space, and a Mastodon server written twice ("user@host@host").
 * @param {string} network
 * @param {string} handle
 * @returns {string}
 */
export function cleanHandle(network, handle) {
  let clean = String(handle ?? '')
    .replace(INVISIBLE, '')
    .trim();
  if (network === 'mastodon') {
    clean = clean.replace(/^(@?[^@\s]+@([^@\s]+))@\2$/i, '$1');
  }
  return clean;
}
