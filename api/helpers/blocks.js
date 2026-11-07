import { DateTime } from 'luxon';

// Site HTML for the editor's custom blocks. Article cards and roundups get their reading entries
// attached as `data.entry` before rendering (see backend/helpers/postContext.js); their stored
// snapshot is the fallback when an entry is gone.

const escapeHtml = (text) =>
  String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const stripTags = (html) =>
  String(html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();

/**
 * "2026-10-30" -> "Oct 30, 2026"; "2026-10" -> "October 2026"; "2026" stays.
 * @param {string} date
 */
export function formatReadDate(date) {
  if (!date) {
    return '';
  }
  const parts = String(date).split('-');
  const parsed = DateTime.fromISO(String(date));
  if (!parsed.isValid) {
    return String(date);
  }
  if (parts.length === 1) {
    return parsed.toFormat('yyyy');
  }
  if (parts.length === 2) {
    return parsed.toFormat('LLLL yyyy');
  }
  return parsed.toFormat('LLL d, yyyy');
}

export function formatDuration(seconds) {
  if (!seconds && seconds !== 0) {
    return '';
  }
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/**
 * When you read something, as a card says it: "Oct 30", with the year when it isn't this year.
 * @param {string} date "2026-10-30", or a month or year
 */
export function readDate(date, { now = DateTime.now() } = {}) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) {
    const parsed = DateTime.fromISO(date);
    if (parsed.isValid) {
      return parsed.toFormat(
        parsed.year === now.year ? 'LLL d' : 'LLL d, yyyy',
      );
    }
  }
  return formatReadDate(date);
}

const LOCK =
  '<svg class="article-card-lock" viewBox="0 0 12 12" width="9" height="9" aria-hidden="true"><rect x="2" y="5.5" width="8" height="5.5" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';

const link = (href, text, className) =>
  href
    ? `<a${className ? ` class="${className}"` : ''} href="${escapeHtml(href)}">${text}</a>`
    : '';

// An entry's own paywall setting wins; unset means its outlet's default.
const isPaywalled = (entry) =>
  typeof entry.paywalled === 'boolean'
    ? entry.paywalled
    : Boolean(entry.outlet?.paywalledByDefault);

const articleMeta = (entry, { paywalled = false } = {}) =>
  [
    entry.work
      ? `<span class="article-card-outlet">${escapeHtml(entry.work)}</span>`
      : null,
    entry.author ? escapeHtml(entry.author) : null,
    paywalled
      ? `<span class="article-card-paywall">${LOCK} paywall</span>`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

const articleTitle = (entry) =>
  entry.href
    ? `<a href="${escapeHtml(entry.href)}">${escapeHtml(entry.title)}</a>`
    : escapeHtml(entry.title);

/**
 * The linked-article card: outlet and author, the headline, excerpts with a hanging quote mark,
 * then when you read it and how to read it yourself. A paywalled article says so after the byline
 * and points to the gift link or the archived copy.
 * @param {Object} entry A reading or press entry (or a card's stored snapshot)
 * @param {{excerpts?: string[], archived?: Object}} [options] archived: url -> Wayback copy
 */
export function renderArticleCard(
  entry,
  { excerpts = [], archived = {} } = {},
) {
  if (!entry) {
    return '';
  }
  const paywalled = isPaywalled(entry);
  const archive = entry.href ? archived[entry.href] : null;
  const read = readDate(entry.completed || entry.started);
  const footer = [
    read ? `read ${escapeHtml(read)}` : null,
    paywalled && entry.giftLink
      ? link(entry.giftLink, 'free gift link ↗', 'article-card-gift')
      : null,
    archive
      ? link(
          archive,
          paywalled && !entry.giftLink ? 'archived copy' : 'archived',
        )
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const quotes = excerpts
    .filter((excerpt) => String(excerpt || '').trim())
    .map(
      (excerpt) =>
        `<blockquote class="article-card-excerpt"><p>${escapeHtml(excerpt)}</p></blockquote>`,
    )
    .join('');
  return `<aside class="article-card${paywalled ? ' paywalled' : ''}">
<p class="article-card-meta">${articleMeta(entry, { paywalled })}</p>
<p class="article-card-title">${articleTitle(entry)}</p>
${quotes}${footer ? `<p class="article-card-footer">${footer}</p>` : ''}
</aside>`;
}

/** "Linked article" block: a reading entry and the excerpts picked from it. */
export function renderArticle({ data, archived }) {
  return renderArticleCard(data.entry || data.snapshot, {
    excerpts: data.excerpts || [],
    archived,
  });
}

/** "Link roundup": several articles, each with a line, in one tinted block. */
export function renderRoundup({ data, archived = {} }) {
  const entries = (data.items || [])
    .map((item) => ({ item, entry: item.entry || item.snapshot }))
    .filter(({ entry }) => entry);
  if (!entries.length) {
    return '';
  }
  const items = entries.map(
    ({ item, entry }) => `<div class="roundup-item">
<p class="article-card-meta">${articleMeta(entry)}</p>
<p class="article-card-title">${articleTitle(entry)}</p>
${item.line ? `<p class="roundup-line">${escapeHtml(item.line)}</p>` : ''}
</div>`,
  );
  const allArchived = entries.every(
    ({ entry }) => entry.href && archived[entry.href],
  );
  const footer = [
    `${entries.length} link${entries.length === 1 ? '' : 's'}`,
    allArchived ? 'all archived' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return `<div class="roundup">${items.join('')}</div><p class="roundup-footer">${footer}</p>`;
}

/**
 * A quote: a step smaller than your own words, with a light rule. Words you highlighted in it are
 * pulled out large. When the post links one article, "read in context" goes to the passage in it.
 */
export function renderQuote({ data }) {
  const parts = String(data.text || '')
    .split(/(<mark>[\s\S]*?<\/mark>)/)
    .filter((part) => stripTags(part));
  const hasPull = parts.some((part) => part.startsWith('<mark>'));
  const paragraphs = parts
    .map((part) =>
      part.startsWith('<mark>')
        ? `<p class="pull-quote">${part.slice(6, -7)}</p>`
        : `<p>${part.trim()}</p>`,
    )
    .join('');
  const caption = data.caption
    ? `<figcaption><cite>– ${data.caption}</cite></figcaption>`
    : '';
  const context = data.contextUrl
    ? `<p class="quote-context"><a href="${escapeHtml(data.contextUrl)}">↗ read in context</a></p>`
    : '';
  return `<figure class="quote${hasPull ? ' has-pull' : ''}"><blockquote>${paragraphs}</blockquote>${caption}${context}</figure>`;
}

const NUMERIC = /^[-+(]?[$€£]?\s?[\d.,]+\s?(%|[KMB]|million|billion)?\)?$/i;

/** Data table: header row, right-aligned numeric columns, optional total row, source line, CSV. */
export function renderTable({ data }) {
  const rows = data.content || [];
  if (!rows.length) {
    return '';
  }
  const header = data.withHeadings ? rows[0] : null;
  const body = data.withHeadings ? rows.slice(1) : rows;
  const columns = Math.max(...rows.map((row) => row.length));
  const numeric = Array.from({ length: columns }, (_, col) => {
    const cells = body.map((row) => stripTags(row[col])).filter(Boolean);
    return cells.length > 0 && cells.every((cell) => NUMERIC.test(cell));
  });
  const cell = (tag, html, col) =>
    `<${tag}${numeric[col] ? ' class="numeric"' : ''}>${html ?? ''}</${tag}>`;

  const thead = header
    ? `<thead><tr>${header.map((html, col) => cell('th', html, col)).join('')}</tr></thead>`
    : '';
  const tbody = body
    .map((row, i) => {
      const isTotal = data.totalRow && i === body.length - 1;
      return `<tr${isTotal ? ' class="total"' : ''}>${row.map((html, col) => cell('td', html, col)).join('')}</tr>`;
    })
    .join('');

  const csv = rows
    .map((row) =>
      row.map((html) => `"${stripTags(html).replace(/"/g, '""')}"`).join(','),
    )
    .join('\n');
  const csvLink = `<a href="data:text/csv;charset=utf-8,${encodeURIComponent(csv)}" download="table.csv">csv</a>`;
  const footer = [
    data.source ? `source: ${escapeHtml(data.source)}` : null,
    data.asOf ? `as of ${escapeHtml(formatReadDate(data.asOf))}` : null,
    csvLink,
  ]
    .filter(Boolean)
    .join(' · ');

  return `<figure class="data-table"><table>${thead}<tbody>${tbody}</tbody></table><figcaption>${footer}</figcaption></figure>`;
}

/** Your own copy of a video or audio file, in the browser's player. */
export function renderMedia({ data }) {
  if (!data.url) {
    return '';
  }
  const player =
    data.kind === 'audio'
      ? `<audio controls preload="metadata" src="${escapeHtml(data.url)}"></audio>`
      : `<video controls preload="metadata" src="${escapeHtml(data.url)}"${data.poster ? ` poster="${escapeHtml(data.poster)}"` : ''}></video>`;
  const caption = [data.caption, formatDuration(data.duration)]
    .filter(Boolean)
    .join(' · ');
  return `<figure class="media-block media-block--${data.kind === 'audio' ? 'audio' : 'video'}">${player}${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
}
