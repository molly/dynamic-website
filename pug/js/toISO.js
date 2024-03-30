import { DateTime } from 'luxon';

export const toISOWithoutMillis = (date) => {
  let luxonDate;
  if (date instanceof DateTime) {
    luxonDate = date;
  } else if (date instanceof Date) {
    luxonDate = DateTime.fromJSDate(date);
  }
  return luxonDate
    .set({ millisecond: 0 })
    .toISO({ suppressMilliseconds: true });
};
