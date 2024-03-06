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

export const preprocess = (data, { defaultArticle }, getTags = false) => {
  const processed = [];
  const tagsMap = {};
  for (let article of data) {
    let updatedArticle = { ...defaultArticle, ...article };

    // Dates
    const formattedDates = formatArticleDate(updatedArticle);
    Object.assign(updatedArticle, formattedDates);

    processed.push(updatedArticle);

    // Used for .json files where tags are simple arrays of strings
    if (getTags) {
      for (let tag of updatedArticle.tags) {
        if (Object.prototype.hasOwnProperty.call(tagsMap, tag)) {
          tagsMap[tag].frequency += 1;
        } else {
          tagsMap[tag] = {
            text: tag.replace('_', ' '),
            value: tag,
            frequency: 1,
          };
        }
      }
    }
  }

  const results = { results: processed };
  if (getTags) {
    results.allTags = Object.values(tagsMap);
    results.allTags.sort((a, b) =>
      a.text.toLowerCase().localeCompare(b.text.toLowerCase()),
    );
  }
  return results;
};
