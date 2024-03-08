import { DateTime } from 'luxon';
const ONE_MONTH = 1000 * 60 * 60 * 24 * 30;

export const hydrateTimestamps = (entry) => {
  if (!entry) {
    return {};
  }
  const timestamps = {};
  for (let ts of ['createdAt', 'updatedAt', 'deletedAt']) {
    if (ts in entry) {
      const createdAtDt = DateTime.fromJSDate(entry.createdAt);
      const absoluteTime = createdAtDt.toLocaleString(DateTime.DATETIME_FULL);
      const relativeTime = DateTime.now() - createdAtDt;
      let humanTime = absoluteTime;
      if (relativeTime < ONE_MONTH) {
        humanTime = createdAtDt.toRelative();
      }
      timestamps[ts] = { absoluteTime, humanTime };
    }
  }
  return timestamps;
};
