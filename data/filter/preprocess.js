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

export const getTags = (article, tagText) => {
  if (!article.tags || !article.tags.length) {
    return [];
  }
  const tags = article.tags.map((tag) => ({
    text: Object.prototype.hasOwnProperty.call(tagText, tag)
      ? tagText[tag]
      : tag.replace(/_/g, ' '),
    value: tag,
  }));
  tags.sort((a, b) => a.text.toLowerCase().localeCompare(b.text.toLowerCase()));
  return tags;
};

export const preprocess = (data, { defaultArticle, tagText }) => {
  const processed = [];
  const tagsMap = {};
  for (let article of data) {
    let updatedArticle = { ...defaultArticle, ...article };

    // Dates
    const formattedDates = formatArticleDate(updatedArticle);
    Object.assign(updatedArticle, formattedDates);

    // Tags
    updatedArticle.tags = getTags(updatedArticle, tagText);

    processed.push(updatedArticle);
    for (let tag of updatedArticle.tags) {
      if (Object.prototype.hasOwnProperty.call(tagsMap, tag.value)) {
        tagsMap[tag.value].frequency += 1;
      } else {
        tagsMap[tag.value] = { ...tag, frequency: 1 };
      }
    }
  }

  const allTags = Object.values(tagsMap);
  allTags.sort((a, b) =>
    a.text.toLowerCase().localeCompare(b.text.toLowerCase()),
  );

  return { results: processed, allTags };
};
