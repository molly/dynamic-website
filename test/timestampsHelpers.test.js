import { hydrateTimestamps } from '../api/helpers/timestamps.js';

describe('timestamps helpers', () => {
  test('adds human readable timestamps to entry far in the past', () => {
    const entry = {
      createdAt: new Date('2021-01-01T12:00:00Z'),
    };
    const hydrated = hydrateTimestamps(entry);
    expect(hydrated.absoluteTime).toBe('January 1, 2021 at 7:00 AM EST');
    expect(hydrated.humanTime).toBe('January 1, 2021 at 7:00 AM EST');
  });

  test('adds relative timestamp to recent entry', () => {
    const entry = {
      createdAt: new Date(Date.now() - 86400000),
    };
    const hydrated = hydrateTimestamps(entry);
    expect(hydrated.humanTime).toBe('1 day ago');
  });
});
