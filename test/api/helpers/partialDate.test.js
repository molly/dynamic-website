import {
  PARTIAL_DATE_PATTERN,
  formatPartialDate,
  normalizePartialDate,
} from '../../../api/helpers/partialDate';

describe('partial dates', () => {
  it.each([['2019'], ['2019-03'], ['2019-03-05'], [' 2024-02-29 ']])(
    'accepts %s',
    (value) => {
      expect(normalizePartialDate(value)).toBe(value.trim());
    },
  );

  it.each([
    ['19'],
    ['2019-3'],
    ['2019-13'],
    ['2019-02-30'],
    ['2023-02-29'],
    ['March 2019'],
    ['2019/03/05'],
    [''],
  ])('refuses %s', (value) => {
    expect(normalizePartialDate(value)).toBeNull();
  });

  it('shows each as precisely as it’s known', () => {
    expect(formatPartialDate('2019')).toBe('2019');
    expect(formatPartialDate('2019-03')).toBe('Mar 2019');
    expect(formatPartialDate('2019-03-05')).toBe('Mar 5, 2019');
    expect(formatPartialDate(undefined)).toBe('');
  });

  it('sorts in date order as text', () => {
    expect(['2020', '2019-03-05', '2019', '2019-11'].sort()).toEqual([
      '2019',
      '2019-03-05',
      '2019-11',
      '2020',
    ]);
  });

  it('gives the form a pattern matching the same shapes', () => {
    const pattern = new RegExp(`^(?:${PARTIAL_DATE_PATTERN})$`);
    expect(
      ['2019', '2019-03', '2019-03-05'].every((v) => pattern.test(v)),
    ).toBe(true);
    expect(pattern.test('2019-3')).toBe(false);
  });
});
