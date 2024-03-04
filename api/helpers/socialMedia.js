export const NETWORKS = ['twitter', 'mastodon', 'bluesky', 'tiktok', 'youtube'];

const SOCIAL_PREFIXES = {
  twitter: 'https://twitter.com/molly0xFFF/status/',
  mastodon: 'https://hachyderm.io/@molly0xfff/',
  bluesky: 'https://bsky.app/profile/molly.wiki/post/',
  tiktok: 'https://www.tiktok.com/@molly0xfff/',
  youtube: 'https://www.youtube.com/watch?v=',
};

// For linking to other users' profiles
export const GENERIC_SOCIAL_PREFIXES = {
  twitter: 'https://twitter.com/',
  bluesky: 'https://bsky.app/profile/',
  tiktok: 'https://www.tiktok.com/@',
  youtube: 'https://www.youtube.com/channel/',
};

export function hydrateAndSortSocialLinks(links) {
  const order = ['twitter', 'mastodon', 'bluesky', 'tiktok', 'youtube'];
  links.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  for (const link of links) {
    link.href = `${SOCIAL_PREFIXES[link.type]}${link.postId}`;
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
  return `${GENERIC_SOCIAL_PREFIXES[network]}${handle}`;
}
