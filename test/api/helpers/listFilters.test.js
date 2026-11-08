import {
  listHref,
  splitChips,
  tagChips,
  tagText,
} from '../../../api/helpers/listFilters';

describe('list filters', () => {
  it('links to a list with its filters, in order, leaving out empty ones and page 1', () => {
    expect(listHref('/reading/books')).toBe('/reading/books');
    expect(
      listHref('/reading/books', {
        status: 'read',
        type: '',
        tags: ['fantasy', 'cozy'],
        search: 'carl',
        order: '',
        page: 1,
      }),
    ).toBe('/reading/books?status=read&tags=fantasy-cozy&search=carl');
    expect(listHref('/press', { tags: [], page: 3 })).toBe('/press?page=3');
  });

  it('gives each tag its count, its share of the most used, and a link that toggles it', () => {
    const allTags = [
      { value: 'a', text: 'A', n: 10 },
      { value: 'b', text: 'B', n: 5 },
      { value: 'c', text: 'C' },
    ];
    const chips = tagChips(allTags, ['b'], {
      count: (tag) => tag.n,
      href: (tags) => listHref('/x', { tags }),
    });
    expect(chips).toEqual([
      {
        value: 'a',
        text: 'A',
        count: 10,
        share: 1,
        current: false,
        href: '/x?tags=b-a',
      },
      {
        value: 'b',
        text: 'B',
        count: 5,
        share: 0.5,
        current: true,
        href: '/x',
      },
      {
        value: 'c',
        text: 'C',
        count: 0,
        share: 0,
        current: false,
        href: '/x?tags=b-c',
      },
    ]);
  });

  it('shows the first chips and any chosen one, and puts the rest behind "more"', () => {
    const chips = ['a', 'b', 'c', 'd'].map((value) => ({
      value,
      current: value === 'd',
    }));
    const { shown, more } = splitChips(chips, 2);
    expect(shown.map((c) => c.value)).toEqual(['a', 'b', 'd']);
    expect(more.map((c) => c.value)).toEqual(['c']);
  });

  it('writes tags as the site does', () => {
    expect(tagText({ text: 'Crypto lobby' })).toBe('#crypto-lobby');
  });
});
