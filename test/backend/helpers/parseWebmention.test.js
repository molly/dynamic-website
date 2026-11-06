import { parseWebmentionSource } from '../../../backend/helpers/parseWebmention.js';

const source = 'https://example.com/posts/reply';
const target = 'https://www.mollywhite.net/micro/entry/some-post';

describe('parseWebmentionSource', () => {
  test('returns a warning instead of throwing when there is no h-entry', () => {
    const result = parseWebmentionSource({
      html: `<html><head><link rel="author" href="https://example.com/me"></head><body><a href="${target}">x</a></body></html>`,
      source,
      target,
    });
    expect(result.mentionUrl).toBe(source);
    expect(result.authorUrl).toBe('https://example.com/me');
    expect(result.warning).toMatch(/No h-entry/);
  });

  test('parses a reply with a plain u-in-reply-to link and h-card author', () => {
    const result = parseWebmentionSource({
      html: `
        <article class="h-entry">
          <a class="p-author h-card" href="https://example.com">Test Person</a>
          <time class="dt-published" datetime="2026-11-06T10:00:00Z">today</time>
          <div class="e-content">Replying to <a class="u-in-reply-to" href="${target}">your post</a></div>
        </article>`,
      source,
      target,
    });
    expect(result.warning).toBeUndefined();
    expect(result.author).toBe('Test Person');
    expect(result.authorUrl).toBe('https://example.com');
    expect(result.published).toBe('2026-11-06T10:00:00Z');
    expect(result.content).toContain('Replying to');
    expect(result.type).toBe('reply');
  });

  test('detects types given as nested h-cite', () => {
    const result = parseWebmentionSource({
      html: `
        <article class="h-entry">
          <div class="u-like-of h-cite"><a class="u-url" href="${target}">post</a></div>
        </article>`,
      source,
      target,
    });
    expect(result.type).toBe('like');
  });

  test('handles an h-entry with no content and a string author', () => {
    const result = parseWebmentionSource({
      html: `
        <div class="h-feed"><article class="h-entry">
          <span class="p-author">Someone</span>
          <a class="u-bookmark-of" href="${target}">bookmarked</a>
        </article></div>`,
      source,
      target,
    });
    expect(result.author).toBe('Someone');
    expect(result.content).toBeUndefined();
    expect(result.type).toBe('bookmark');
  });

  test('does not assign a type for references to other URLs', () => {
    const result = parseWebmentionSource({
      html: `<article class="h-entry"><a class="u-in-reply-to" href="https://other.example/">x</a><p class="e-content">${target}</p></article>`,
      source,
      target,
    });
    expect(result.type).toBeUndefined();
  });
});
