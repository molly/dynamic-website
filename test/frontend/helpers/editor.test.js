import {
  getSlugFromTitle,
  socialLinksToArray,
  socialLinksToMap,
} from '../../../frontend/js/helpers/editorHelpers';

describe('editor helpers', () => {
  test('creates slug from post title', () => {
    expect(getSlugFromTitle('Hello World')).toBe('hello-world');
    expect(getSlugFromTitle('Hello-World!')).toBe('hello-world');
    expect(getSlugFromTitle('Hello World 123@')).toBe('hello-world-123');
  });

  test('converts social links array to map', () => {
    const socialLinks = [
      { type: 'twitter', postId: '123' },
      { type: 'mastodon', postId: '456' },
    ];
    const expected = {
      twitter: '123',
      mastodon: '456',
    };
    expect(socialLinksToMap(socialLinks)).toEqual(expected);
  });

  test('converts social links map to array', () => {
    const socialLinks = {
      twitter: '123',
      mastodon: '456',
    };
    const expected = [
      { type: 'twitter', postId: '123' },
      { type: 'mastodon', postId: '456' },
    ];
    expect(socialLinksToArray(socialLinks)).toEqual(expected);
  });

  test('converts social links map to array, omitting nulls/undefined', () => {
    const socialLinks = {
      twitter: undefined,
      mastodon: '456',
      bluesky: null,
    };
    const expected = [{ type: 'mastodon', postId: '456' }];
    expect(socialLinksToArray(socialLinks)).toEqual(expected);
  });
});
