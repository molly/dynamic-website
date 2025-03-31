export const NETWORKS = [
  'twitter',
  'mastodon',
  'bluesky',
  'threads',
  'tiktok',
  'youtube',
];
export const MENTION_NETWORKS = ['website', 'wikipedia', ...NETWORKS];

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
  wikipedia: 'https://en.wikipedia.org/wiki/',
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
  } else if (network === 'wikipedia') {
    return `${GENERIC_SOCIAL_PREFIXES.wikipedia}${handle.replace(/ /g, '_')}`;
  }
  return `${GENERIC_SOCIAL_PREFIXES[network]}${handle}`;
}
