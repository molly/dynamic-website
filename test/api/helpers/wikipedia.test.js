import {
  isWikipediaLink,
  wikipediaArticleUrl,
} from '../../../api/helpers/wikipedia';

describe('wikipediaArticleUrl', () => {
  it.each([
    [
      'https://en.wikipedia.org/wiki/Elizabeth_Warren',
      'https://en.wikipedia.org/wiki/Elizabeth_Warren',
    ],
    [
      'en.wikipedia.org/wiki/Elizabeth_Warren',
      'https://en.wikipedia.org/wiki/Elizabeth_Warren',
    ],
    [
      'https://en.m.wikipedia.org/wiki/Elizabeth_Warren#Career',
      'https://en.wikipedia.org/wiki/Elizabeth_Warren',
    ],
    ['Elizabeth Warren', 'https://en.wikipedia.org/wiki/Elizabeth_Warren'],
    [
      'David Pearce (philosopher)',
      'https://en.wikipedia.org/wiki/David_Pearce_(philosopher)',
    ],
    [
      'https://en.wikipedia.org/wiki/David_Pearce_%28philosopher%29',
      'https://en.wikipedia.org/wiki/David_Pearce_(philosopher)',
    ],
    [
      'https://de.wikipedia.org/wiki/K%C3%B6ln',
      'https://de.wikipedia.org/wiki/K%C3%B6ln',
    ],
    ['AT&T', 'https://en.wikipedia.org/wiki/AT%26T'],
  ])('%s', (input, expected) => {
    expect(wikipediaArticleUrl(input)).toBe(expected);
  });

  it.each([
    [''],
    ['https://en.wikipedia.org/'],
    ['https://example.com/wiki/Elizabeth_Warren'],
    ['example.com/Elizabeth_Warren'],
  ])('is null for %s', (input) => {
    expect(wikipediaArticleUrl(input)).toBeNull();
  });
});

describe('isWikipediaLink', () => {
  it('spots links to Wikipedia, and only those', () => {
    expect(isWikipediaLink('https://en.wikipedia.org/wiki/X')).toBe(true);
    expect(isWikipediaLink('en.m.wikipedia.org/wiki/X')).toBe(true);
    expect(isWikipediaLink('https://notwikipedia.org/wiki/X')).toBe(false);
    expect(isWikipediaLink('Elizabeth Warren')).toBe(false);
  });
});
