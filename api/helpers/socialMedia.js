const SOCIAL_PREFIXES = {
  twitter: 'https://twitter.com/molly0xFFF/status/',
  mastodon: 'https://hachyderm.io/@molly0xfff/',
  bluesky: 'https://bsky.app/profile/molly.wiki/post/',
  tiktok: 'https://www.tiktok.com/@molly0xfff/',
  youtube: 'https://www.youtube.com/watch?v=',
};

export function hydrateAndSortSocialLinks(links) {
  const order = ['twitter', 'mastodon', 'bluesky', 'tiktok', 'youtube'];
  links.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  for (const link of links) {
    link.href = `${SOCIAL_PREFIXES[link.type]}${link.postId}`;
  }
  return links;
}
