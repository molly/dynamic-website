import { DateTime } from 'luxon';
const TWO_WEEKS = 1000 * 60 * 60 * 24 * 14;

/**
 * A date as the site shows it: in full, in full in Eastern time, and relative when recent.
 * @param {Date} date
 * @returns {{absoluteTime: string, humanTime: string, absoluteTimeET: string}}
 */
export const formatTimestamp = (date) => {
  const dt = DateTime.fromJSDate(date);
  const absoluteTime = dt.toLocaleString(DateTime.DATETIME_FULL);
  const absoluteTimeET = dt.toLocaleString(DateTime.DATETIME_FULL, {
    zone: 'America/New_York',
  });
  const humanTime =
    DateTime.now() - dt < TWO_WEEKS ? dt.toRelative() : absoluteTime;
  return { absoluteTime, humanTime, absoluteTimeET };
};

export const hydrateTimestamps = (entry) => {
  if (!entry) {
    return {};
  }
  const timestamps = {};
  for (let ts of ['createdAt', 'updatedAt', 'deletedAt']) {
    if (ts in entry) {
      timestamps[ts] = formatTimestamp(entry[ts]);
    }
  }
  return timestamps;
};
