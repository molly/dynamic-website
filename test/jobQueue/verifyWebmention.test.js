import { sourceLinksToTarget } from '../../jobQueue/verifyWebmention.js';

const source = 'https://example.com/posts/hello';
const target = 'https://www.mollywhite.net/micro/entry/some-post';

const html = (inner) => `<html><body>${inner}</body></html>`;

describe('sourceLinksToTarget', () => {
  test('matches an absolute link to the target', () => {
    expect(
      sourceLinksToTarget({
        body: html(`<p>See <a href="${target}">this</a></p>`),
        contentType: 'text/html; charset=utf-8',
        source,
        target,
      }),
    ).toBe(true);
  });

  test('rejects HTML that does not link to the target', () => {
    expect(
      sourceLinksToTarget({
        body: html('<p><a href="https://www.mollywhite.net/other">x</a></p>'),
        contentType: 'text/html',
        source,
        target,
      }),
    ).toBe(false);
  });

  test('ignores fragment differences', () => {
    expect(
      sourceLinksToTarget({
        body: html(`<a href="${target}#comments">x</a>`),
        contentType: 'text/html',
        source,
        target,
      }),
    ).toBe(true);
  });

  test('resolves relative links against the source', () => {
    expect(
      sourceLinksToTarget({
        body: html('<a href="/micro/entry/some-post">x</a>'),
        contentType: 'text/html',
        source: 'https://www.mollywhite.net/micro/entry/another',
        target,
      }),
    ).toBe(true);
  });

  test('matches media sources', () => {
    expect(
      sourceLinksToTarget({
        body: html(`<img src="${target}">`),
        contentType: 'text/html',
        source,
        target,
      }),
    ).toBe(true);
  });

  test('handles URLs containing quotes or selector metacharacters', () => {
    const weirdTarget = 'https://www.mollywhite.net/micro/entry/a"b?c=[1]';
    expect(
      sourceLinksToTarget({
        body: html(`<a href='${weirdTarget}'>x</a>`),
        contentType: 'text/html',
        source,
        target: weirdTarget,
      }),
    ).toBe(true);
  });

  test('matches JSON and plain text bodies containing the target', () => {
    expect(
      sourceLinksToTarget({
        body: JSON.stringify({ url: target }),
        contentType: 'application/json',
        source,
        target,
      }),
    ).toBe(true);
    expect(
      sourceLinksToTarget({
        body: `check out ${target}`,
        contentType: 'text/plain',
        source,
        target,
      }),
    ).toBe(true);
  });

  test('rejects missing content type or unsupported types', () => {
    expect(
      sourceLinksToTarget({
        body: target,
        contentType: undefined,
        source,
        target,
      }),
    ).toBe(false);
    expect(
      sourceLinksToTarget({
        body: target,
        contentType: 'application/pdf',
        source,
        target,
      }),
    ).toBe(false);
  });
});
