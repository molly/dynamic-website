const moment = require('moment');
const MOMENT_FORMATS = require('../constants/momentFormats');

const SAME_MONTH_REGEX = new RegExp(/([A-Za-z]+ \d{1,2})[-–]\d{1,2}(, \d{4})/);
const DIFFERENT_MONTHS_REGEX = new RegExp(
  /([A-Za-z]+ \d{1,2})[-–][A-Za-z]+ \d{1,2}(, \d{4})/,
);

function getMomentFromWeek(week) {
  const sameMatch = week.match(SAME_MONTH_REGEX);
  if (sameMatch) {
    return moment(sameMatch[1] + sameMatch[2], 'MMMM D, YYYY');
  }
  const differentMatch = week.match(DIFFERENT_MONTHS_REGEX);
  if (differentMatch) {
    return moment(differentMatch[1] + differentMatch[2], 'MMMM D, YYYY');
  }
  return moment('1970-01-01', MOMENT_FORMATS);
}

function makeSortByWeek(order) {
  return function (a, b) {
    const sortValA = getMomentFromWeek(a.week);
    const sortValB = getMomentFromWeek(b.week);
    if (order && order === 'reverse') {
      return sortValA - sortValB;
    }
    return sortValB - sortValA;
  };
}

module.exports = {
  makeSortByWeek,
  getMomentFromWeek,
};
