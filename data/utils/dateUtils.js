import moment from 'moment';
import MOMENT_FORMATS from '../constants/momentFormats.js';

export function makeSortBySimpleDateKey(key, order) {
  return function (a, b) {
    const sortValA = moment(a[key], MOMENT_FORMATS);
    const sortValB = moment(b[key], MOMENT_FORMATS);
    if (order && order === 'reverse') {
      return sortValA - sortValB;
    }
    return sortValB - sortValA;
  };
}
