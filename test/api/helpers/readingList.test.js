import { DateTime } from 'luxon';
import {
  bookReadingDates,
  bookRow,
  booksHref,
  readingDate,
  readingQuery,
  readingTags,
  shortformHref,
} from '../../../api/helpers/readingList';

const now = DateTime.fromISO('2026-11-08T12:00:00', {
  zone: 'America/New_York',
});

describe('reading lists', () => {
  it('reads filters from the query string, ignoring unknown statuses and types', () => {
    expect(
      readingQuery({
        tags: 'fantasy-cozy',
        status: 'dnf',
        type: 'nonfiction',
        order: 'reverse',
      }),
    ).toEqual({
      tags: ['fantasy', 'cozy'],
      search: '',
      order: 'reverse',
      status: 'dnf',
      type: 'nonfiction',
    });
    expect(
      readingQuery({ status: 'toRead', type: 'poetry', order: 'x' }),
    ).toMatchObject({
      status: '',
      type: '',
      order: '',
    });
  });

  it('links to each list with its filters', () => {
    expect(shortformHref({ tags: ['law'], order: 'reverse', page: 2 })).toBe(
      '/reading/shortform?tags=law&order=reverse&page=2',
    );
    expect(
      booksHref({
        status: 'currentlyReading',
        type: 'fiction',
        search: 'bosch',
      }),
    ).toBe('/reading/books?status=currentlyReading&type=fiction&search=bosch');
  });

  it('lists the ten most used tags, then the rest, with the total', () => {
    const allTags = Array.from({ length: 12 }, (_, i) => ({
      value: `t${i}`,
      text: `t${i}`,
      n: 12 - i,
    }));
    const tags = readingTags(allTags, [], {
      count: (tag) => tag.n,
      href: (values) => shortformHref({ tags: values }),
    });
    expect(tags.shown).toHaveLength(10);
    expect(tags.more.map((t) => t.value)).toEqual(['t10', 't11']);
    expect(tags.total).toBe(12);
  });

  it('writes dates as precisely as they are known', () => {
    expect(readingDate('2026-11-01', { now })).toBe('Nov 1');
    expect(readingDate('2024-10-30', { now })).toBe('Oct 30, 2024');
    expect(readingDate('2024-10', { now })).toBe('Oct 2024');
    expect(readingDate('2019', { now })).toBe('2019');
    expect(readingDate(undefined, { now })).toBe('');
  });

  it('says when a book was read', () => {
    expect(
      bookReadingDates({ started: '2026-10-16', completed: '2026-10-24' }),
    ).toBe('Oct 16 → Oct 24, 2026');
    expect(
      bookReadingDates({ started: '2025-12-30', completed: '2026-01-02' }),
    ).toBe('Dec 30, 2025 → Jan 2, 2026');
    expect(
      bookReadingDates({ started: '2026-10-16', completed: '2026-10-17' }),
    ).toBe('Oct 16 → Oct 17, 2026');
    expect(
      bookReadingDates({ started: '2026-10-16', completed: '2026-10-16' }),
    ).toBe('Oct 16, 2026');
    expect(bookReadingDates({ started: '2026-11-02' }, { now })).toBe(
      'started Nov 2',
    );
    expect(bookReadingDates({ completed: '2020-05' }, { now })).toBe(
      'finished May 2020',
    );
    expect(bookReadingDates({})).toBe('');
  });

  it('labels a book’s status and publication', () => {
    expect(
      bookRow({ date: '2000-03-01', status: 'currentlyReading' }, { now }),
    ).toMatchObject({
      publishedLabel: 'published 2000',
      statusLabel: 'reading',
    });
    expect(bookRow({ date: '2027', status: 'dnf' }, { now })).toMatchObject({
      publishedLabel: 'to be published 2027',
      statusLabel: 'did not finish',
    });
  });
});
