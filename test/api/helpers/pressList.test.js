import {
  groupPressByMonth,
  pressHref,
  pressTagChips,
} from '../../../api/helpers/pressList';

describe('press page', () => {
  it('links to the page with its filters, leaving out defaults', () => {
    expect(pressHref()).toBe('/press');
    expect(
      pressHref({
        tags: ['crypto', 'crypto_lobby'],
        search: 'super PAC',
        order: 'reverse',
        page: 2,
      }),
    ).toBe(
      '/press?tags=crypto-crypto_lobby&search=super+PAC&order=reverse&page=2',
    );
  });

  it('shows the most used tags, chosen ones always, and toggles each', () => {
    const tag = (value, count) => ({
      value,
      text: value,
      frequency: { press: count },
    });
    const allTags = Array.from({ length: 12 }, (_, i) => tag(`t${i}`, 12 - i));
    const { shown, more } = pressTagChips(allTags, {
      tags: ['t11'],
      search: '',
      order: '',
    });
    expect(shown.map((c) => c.value)).toEqual([
      ...Array.from({ length: 10 }, (_, i) => `t${i}`),
      't11',
    ]);
    expect(more.map((c) => c.value)).toEqual(['t10']);
    expect(shown[0]).toMatchObject({
      count: 12,
      current: false,
      href: '/press?tags=t11-t0',
    });
    expect(shown.at(-1)).toMatchObject({ current: true, href: '/press' });
  });

  it('groups entries by month, with each one’s day', () => {
    const months = groupPressByMonth([
      { title: 'a', date: '2026-11-05' },
      { title: 'b', date: '2026-11' },
      { title: 'c', date: '2026-10-30' },
      { title: 'd', date: '2019' },
    ]);
    expect(months.map((m) => [m.label, m.rows.map((r) => r.dayLabel)])).toEqual(
      [
        ['November 2026', ['Nov 5', null]],
        ['October 2026', ['Oct 30']],
        ['2019', [null]],
      ],
    );
  });
});
