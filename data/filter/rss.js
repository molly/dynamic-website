import { DateTime } from 'luxon';
import pug from 'pug';

// Trim the summary to length characters without splitting words, then append ellipses
const getSummaryExcerpt = (summary, length) => {
  if (summary.length <= length) {
    return summary;
  }
  const trimmed = summary.substr(0, summary.lastIndexOf(' ', length));
  return trimmed + '...';
};

const makeSummary = (article) => {
  let summary = `"${article.title}"`;
  if (article.parenthetical) {
    summary += ` (${article.parenthetical})`;
  }

  if (article.parenthetical || !article.title.match(/[.?!]$/m)) {
    summary += '. ';
  } else {
    summary += ' ';
  }

  if (article.author) {
    summary += article.author;
  }
  if (article.work || article.publisher) {
    if (article.preposition != null) {
      summary += ` ${article.preposition}`;
    } else if (article.work) {
      summary += ' in';
    } else {
      summary += ' for';
    }
  }
  if (article.work) {
    summary += ` ${article.work}`;
  }
  if (article.publisher) {
    if (article.work) {
      summary += ' for';
    }
    summary += ` ${article.publisher}`;
  }

  if (article.formattedDate) {
    summary += ` on ${article.formattedDate}.`;
  } else if (article.author || article.work || article.publisher) {
    summary += '.';
  }
  if (article.summary) {
    const textOnlySummary = article.summary.replace(/(<([^>]+)>)/gi, '');
    const trimmedSummary = getSummaryExcerpt(textOnlySummary, 200);
    return summary + ' ' + trimmedSummary;
  }
  return summary;
};

const getRssResults = (data, template) => {
  const shortformPugTemplate = pug.compileFile(
    new URL(`../../pug/etc/${template}.pug`, import.meta.url),
    { basedir: new URL(`../../pug`, import.meta.url).pathname },
  );

  const withRssValues = data.map((article) => {
    article.entryHtml = shortformPugTemplate({
      article,
    });

    if (article.type === 'article') {
      article.rssSummary = makeSummary(article);
    }
    if (!article.entryAdded) {
      if (article.started) {
        article.entryAdded = DateTime.fromISO(article.started).toISO();
      }
    } else {
      article.entryAdded = DateTime.fromJSDate(article.entryAdded).toISO();
    }

    return article;
  });
  return withRssValues;
};

export default getRssResults;
