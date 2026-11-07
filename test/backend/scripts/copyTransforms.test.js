import {
  pressKind,
  transformMicroEntry,
} from '../../../backend/scripts/copyTransforms';

describe('pressKind', () => {
  it.each([
    [null, 'article'],
    ['Podcast', 'podcast'],
    ['Video podcast', 'podcast'],
    ['Podcast, paywalled', 'podcast'],
    ['Radio show', 'radio'],
    ['Television program', 'tv'],
    ['TV interview', 'tv'],
    ['Video', 'video'],
    ['Talk', 'talk'],
    ['in German', 'article'],
    ['originally published on Platformer', 'article'],
  ])('%s -> %s', (parenthetical, kind) => {
    expect(pressKind(parenthetical)).toEqual(kind);
  });
});

describe('transformMicroEntry', () => {
  it('turns a related post into a one-item list', () => {
    expect(
      transformMicroEntry({
        slug: 'a',
        relatedPost: 'id1',
        relatedPostModel: 'ShortformEntry',
      }),
    ).toEqual({
      slug: 'a',
      relatedPosts: [{ ref: 'id1', model: 'ShortformEntry' }],
    });
  });

  it('gives posts without one an empty list', () => {
    expect(transformMicroEntry({ slug: 'b' })).toEqual({
      slug: 'b',
      relatedPosts: [],
    });
  });
});
