import { DateTime } from 'luxon';
const TWO_WEEKS = 1000 * 60 * 60 * 24 * 14;

export const hydrateTimestamps = (entry) => {
  if (!entry) {
    return {};
  }
  const timestamps = {};
  for (let ts of ['createdAt', 'updatedAt', 'deletedAt']) {
    if (ts in entry) {
      const createdAtDt = DateTime.fromJSDate(entry[ts]);
      const absoluteTime = createdAtDt.toLocaleString(DateTime.DATETIME_FULL);
      const absoluteTimeET = createdAtDt.toLocaleString(
        DateTime.DATETIME_FULL,
        { zone: 'America/New_York' },
      );
      const relativeTime = DateTime.now() - createdAtDt;
      let humanTime = absoluteTime;
      if (relativeTime < TWO_WEEKS) {
        humanTime = createdAtDt.toRelative();
      }
      timestamps[ts] = { absoluteTime, humanTime, absoluteTimeET };
    }
  }
  return timestamps;
};
