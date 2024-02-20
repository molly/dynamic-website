import { DateTime } from 'luxon';

const SAME_MONTH_REGEX = new RegExp(/([A-Za-z]+ \d{1,2})[-–]\d{1,2}(, \d{4})/);
const DIFFERENT_MONTHS_REGEX = new RegExp(
  /([A-Za-z]+ \d{1,2})[-–][A-Za-z]+ \d{1,2}(, \d{4})/,
);

function getDtFromWeek(week) {
  const sameMatch = week.match(SAME_MONTH_REGEX);
  if (sameMatch) {
    return DateTime.fromFormat(sameMatch[1] + sameMatch[2], 'LLLL d, yyyy');
  }
  const differentMatch = week.match(DIFFERENT_MONTHS_REGEX);
  if (differentMatch) {
    return DateTime.fromFormat(
      differentMatch[1] + differentMatch[2],
      'LLLL d, yyyy',
    );
  }
  return DateTime.fromISO('1970-01-01');
}

export function makeSortByWeek(order) {
  return function (a, b) {
    const sortValA = getDtFromWeek(a.week);
    const sortValB = getDtFromWeek(b.week);
    if (order && order === 'reverse') {
      return sortValA - sortValB;
    }
    return sortValB - sortValA;
  };
}
