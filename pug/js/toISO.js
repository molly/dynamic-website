import { DateTime } from 'luxon';

export const toISOWithoutMillis = (date) => {
  let luxonDate;
  if (date instanceof DateTime) {
    luxonDate = date;
  } else if (date instanceof Date) {
    luxonDate = DateTime.fromJSDate(date);
  } else if (typeof date === 'string') {
    luxonDate = DateTime.fromISO(date);
  }
  return luxonDate
    .set({ millisecond: 0 })
    .toISO({ suppressMilliseconds: true });
};

export const webmentionTimestamp = (dateStr) => {
  const date = DateTime.fromISO(dateStr);
  return date.toLocaleString(DateTime.DATETIME_FULL);
};
