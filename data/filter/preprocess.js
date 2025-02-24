import { DateTime } from 'luxon';

const formatDate = (dt, rawDate) => {
  if (dt.year !== 1970) {
    if (rawDate.match(/^\d{4}-\d{1,2}-\d{1,2}$/m)) {
      return dt.toLocaleString(DateTime.DATE_FULL);
    } else if (rawDate.match(/^\d{4}-\d{1,2}$/m)) {
      return dt.toFormat('LLLL yyyy');
    } else if (rawDate.match(/^\d{4}$/m)) {
      return dt.year.toString();
    }
    return null;
  }
};

export const formatArticleDate = (article) => {
  const dates = {};
  if (article.date) {
    const dt = DateTime.fromISO(article.date);
    dates.formattedDate = formatDate(dt, article.date);
  }
  if (article.started) {
    const startedDt = DateTime.fromISO(article.started);
    dates.formattedStarted = formatDate(startedDt, article.started);
  }
  if (article.completed) {
    const completedDt = DateTime.fromISO(article.completed);
    dates.formattedCompleted = formatDate(completedDt, article.completed);
  }
  return dates;
};
