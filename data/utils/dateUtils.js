import { DateTime } from 'luxon';

export function makeSortBySimpleDateKey(key, order) {
  return function (a, b) {
    const sortValA = DateTime.fromISO(a[key]);
    const sortValB = DateTime.fromISO(b[key]);
    if (order && order === 'reverse') {
      return sortValA - sortValB;
    }
    return sortValB - sortValA;
  };
}
