// An entity's Wikipedia article: the page about them, kept in `ids.wikipedia`. It isn't an
// account of theirs, so it's never one of the entity's `accounts`.

const ARTICLE_URL =
  /^https?:\/\/([a-z][a-z-]*)(?:\.m)?\.wikipedia\.org\/wiki\/([^?#]+)/i;

const safeDecode = (text) => {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
};

// "David Pearce (philosopher)" -> "David_Pearce_(philosopher)", escaped for a URL path
const titlePath = (title) =>
  encodeURIComponent(title.replace(/ /g, '_'))
    .replace(/%2F/g, '/')
    .replace(/%3A/g, ':')
    .replace(/%2C/g, ',');

/**
 * The address of a Wikipedia article, from its link (any language, desktop or mobile) or its
 * English Wikipedia title, in one form so the same article always matches:
 * https://en.wikipedia.org/wiki/David_Pearce_(philosopher)
 * @param {string} text A link to the article, or its title
 * @returns {?string} Null if it isn't a Wikipedia article
 */
export function wikipediaArticleUrl(text) {
  const value = String(text || '').trim();
  if (!value) {
    return null;
  }
  let language = 'en';
  let title;
  // A link, with or without its https:// (e.g. "en.wikipedia.org/wiki/…"); anything else is a title
  const looksLikeLink =
    /^https?:\/\//i.test(value) || /^[^\s/]+\.[a-z]{2,}\//i.test(value);
  if (looksLikeLink) {
    const match = ARTICLE_URL.exec(
      /^https?:\/\//i.test(value) ? value : `https://${value}`,
    );
    if (!match) {
      return null;
    }
    language = match[1].toLowerCase();
    title = safeDecode(match[2]);
  } else {
    title = value;
  }
  title = title.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (!title) {
    return null;
  }
  return `https://${language}.wikipedia.org/wiki/${titlePath(title)}`;
}

/**
 * Whether a pasted link is to Wikipedia at all (an article or not).
 * @param {string} text
 */
export const isWikipediaLink = (text) =>
  /^(?:https?:\/\/)?(?:[a-z-]+\.)?(?:m\.)?wikipedia\.org(?:\/|$)/i.test(
    String(text || '').trim(),
  );
