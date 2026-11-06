import * as cheerio from 'cheerio';

// Normalize a URL for comparison, resolving relative URLs against a base.
// Returns null if the URL can't be parsed.
const normalizeUrl = (url, base) => {
  try {
    const parsed = new URL(url, base);
    parsed.hash = '';
    return parsed.href;
  } catch {
    return null;
  }
};

// Determine whether a fetched source document links to the target URL.
// https://www.w3.org/TR/webmention/#webmention-verification
export const sourceLinksToTarget = ({ body, contentType, source, target }) => {
  if (typeof body !== 'string' || !contentType) {
    return false;
  }
  const normalizedTarget = normalizeUrl(target);
  if (!normalizedTarget) {
    return false;
  }

  if (contentType.includes('text/html')) {
    const $ = cheerio.load(body);
    const baseHref = $('base[href]').attr('href');
    const base = baseHref ? normalizeUrl(baseHref, source) || source : source;
    const candidates = [
      ...$('a[href], link[href]')
        .map((_, el) => $(el).attr('href'))
        .get(),
      ...$('img[src], video[src], audio[src], source[src]')
        .map((_, el) => $(el).attr('src'))
        .get(),
    ];
    return candidates.some(
      (url) => normalizeUrl(url, base) === normalizedTarget,
    );
  }

  if (
    contentType.includes('application/json') ||
    contentType.includes('text/plain')
  ) {
    return body.includes(target);
  }

  return false;
};
