import { easternDate } from '../../../api/helpers/easternDate';
import { entityUrl, typeForSegment } from '../../../api/helpers/entityUrls';
import {
  RELATION_NOUNS,
  byYear,
  entryRow,
} from '../../../backend/helpers/entityPage';

describe('entity pages', () => {
  it('has an address only for entities with a page', () => {
    expect(
      entityUrl({ type: 'bill', slug: 'clarity-act', hasPage: true }),
    ).toEqual('/entities/legislation/clarity-act');
    expect(
      entityUrl({ type: 'person', slug: 'someone', hasPage: false }),
    ).toBeNull();
    expect(typeForSegment('people')).toEqual('person');
    expect(typeForSegment('widgets')).toBeNull();
  });

  it('lists entries by year, with titles in italics', () => {
    const rows = [
      {
        __t: 'FeedEntryCitationNeeded',
        _id: 'c',
        title: 'An issue',
        slug: 'i',
        createdAt: new Date('2026-10-30T16:00:00Z'),
      },
      {
        __t: 'FeedEntryMicro',
        _id: 'm',
        micro: { slug: 'p', post: { blocks: [{ data: { text: 'A post' } }] } },
        createdAt: new Date('2025-03-05T16:00:00Z'),
      },
    ].map(entryRow);
    expect(rows[0]).toMatchObject({
      kind: 'newsletter',
      icon: 'envelope',
      date: 'Oct 30',
      italic: true,
      href: 'https://www.citationneeded.news/i',
    });
    expect(rows[1]).toMatchObject({
      kind: 'posts',
      italic: false,
      label: 'A post',
      href: '/micro/entry/p',
    });
    expect(byYear(rows).map((y) => [y.year, y.rows.length])).toEqual([
      [2026, 1],
      [2025, 1],
    ]);
  });

  it('names related entities from this page’s side', () => {
    expect(RELATION_NOUNS.sponsored.to).toEqual('sponsor');
    expect(RELATION_NOUNS.affiliated.from).toEqual('affiliate');
  });
});

describe('dates typed without a time', () => {
  it('are midnight Eastern, so they show as that day in Eastern time', () => {
    const day = easternDate('2025-05-29');
    expect(day.toISOString()).toEqual('2025-05-29T04:00:00.000Z'); // EDT
    expect(easternDate('2025-01-15').toISOString()).toEqual(
      '2025-01-15T05:00:00.000Z',
    ); // EST
    expect(
      day.toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
      }),
    ).toEqual('May 29');
    const exact = new Date('2025-05-29T12:00:00Z');
    expect(easternDate(exact)).toBe(exact);
  });
});
