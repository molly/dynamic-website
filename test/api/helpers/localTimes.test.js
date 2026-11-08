import { formatLocal } from '../../../api/helpers/localTimes';

const at = new Date('2026-11-07T16:24:00Z'); // 11:24 am Eastern
const now = new Date('2026-11-08T12:00:00Z');

describe('times in the reader’s zone', () => {
  it('writes each format the way the site does', () => {
    const la = { timeZone: 'America/Los_Angeles', now };
    expect(formatLocal(at, 'short', la)).toEqual('Nov 7, 8:24 am');
    expect(formatLocal(at, 'day', la)).toEqual('Nov 7');
    expect(formatLocal(at, 'monthDay', la)).toEqual('Nov 7');
    expect(formatLocal(at, 'full', la)).toEqual(
      'Saturday, November 7, 2026 · 8:24 am PST',
    );
    expect(formatLocal(at, 'social', la)).toEqual('8:24 AM · Nov 7, 2026');
  });

  it('adds the year only when it isn’t this year', () => {
    expect(
      formatLocal(new Date('2024-10-01T18:38:00Z'), 'short', {
        timeZone: 'America/New_York',
        now,
      }),
    ).toEqual('Oct 1, 2024, 2:38 pm');
  });

  it('moves to the reader’s day: late evening in New York is the next day in London', () => {
    const late = new Date('2026-11-07T04:30:00Z'); // 11:30 pm Nov 6 in New York
    expect(
      formatLocal(late, 'day', { timeZone: 'America/New_York', now }),
    ).toEqual('Nov 6');
    expect(
      formatLocal(late, 'day', { timeZone: 'Europe/London', now }),
    ).toEqual('Nov 7');
  });

  it('gives just the time for an update on the post’s own day', () => {
    const post = new Date('2026-11-07T15:00:00Z');
    const later = new Date('2026-11-07T21:52:00Z');
    const nextDay = new Date('2026-11-08T14:40:00Z');
    const ny = { timeZone: 'America/New_York', now, ref: post };
    expect(formatLocal(later, 'update', ny)).toEqual('4:52 pm');
    expect(formatLocal(nextDay, 'update', ny)).toEqual('Nov 8, 9:40 am');
    expect(formatLocal(at, 'nonsense', ny)).toBeNull();
  });
});
