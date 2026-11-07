import { parseProfileUrl } from '../../../api/helpers/profileUrl';

describe('parseProfileUrl', () => {
  it.each([
    [
      'https://bsky.app/profile/molly.wiki',
      { network: 'bluesky', handle: 'molly.wiki' },
    ],
    ['https://x.com/molly0xFFF', { network: 'twitter', handle: 'molly0xFFF' }],
    ['twitter.com/molly0xFFF/', { network: 'twitter', handle: 'molly0xFFF' }],
    [
      'https://www.threads.net/@molly0xfff',
      { network: 'threads', handle: 'molly0xfff' },
    ],
    [
      'https://www.tiktok.com/@molly0xfff',
      { network: 'tiktok', handle: 'molly0xfff' },
    ],
    [
      'https://www.youtube.com/@molly0xfff',
      { network: 'youtube', handle: 'molly0xfff' },
    ],
    [
      'https://www.youtube.com/channel/UC123',
      { network: 'youtube', handle: 'UC123' },
    ],
    [
      'https://en.wikipedia.org/wiki/Taylor_Lorenz',
      { network: 'wikipedia', handle: 'Taylor_Lorenz' },
    ],
    [
      'https://hachyderm.io/@molly0xfff',
      { network: 'mastodon', handle: 'molly0xfff@hachyderm.io' },
    ],
    [
      '@molly0xfff@Hachyderm.io',
      { network: 'mastodon', handle: 'molly0xfff@hachyderm.io' },
    ],
    [
      'https://www.citationneeded.news/about',
      { network: 'website', handle: 'https://www.citationneeded.news/about' },
    ],
  ])('%s', (input, expected) => {
    expect(parseProfileUrl(input)).toEqual(expected);
  });

  it.each([
    [''],
    ['Taylor'],
    ['https://x.com/i/status/123'],
    ['https://en.wikipedia.org/'],
  ])('returns null for %s', (input) => {
    expect(parseProfileUrl(input)).toBeNull();
  });
});
