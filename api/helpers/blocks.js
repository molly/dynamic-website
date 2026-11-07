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

const articleMeta = (entry) =>
  [entry.work, entry.author].filter(Boolean).map(escapeHtml).join(' · ');

const articleTitle = (entry) =>
  entry.href
    ? `<a href="${escapeHtml(entry.href)}">${escapeHtml(entry.title)}</a>`
    : escapeHtml(entry.title);

/** "Linked article" card. */
export function renderArticle({ data }) {
  const entry = data.entry || data.snapshot;
  if (!entry) {
    return '';
  }
  const excerpts = (data.excerpts || [])
    .map(
      (excerpt) =>
        `<blockquote class="article-card-excerpt"><p>${escapeHtml(excerpt)}</p></blockquote>`,
    )
    .join('');
  const read = formatReadDate(entry.completed || entry.started);
  return `<aside class="article-card">
<p class="article-card-meta">${articleMeta(entry)}</p>
<p class="article-card-title">${articleTitle(entry)}</p>
${excerpts}${read ? `<p class="article-card-footer">read ${escapeHtml(read)}</p>` : ''}
</aside>`;
}

/** "Link roundup": several articles, each with a line. */
export function renderRoundup({ data }) {
  const items = (data.items || [])
    .map((item) => {
      const entry = item.entry || item.snapshot;
      if (!entry) {
        return '';
      }
      return `<div class="roundup-item">
<p class="article-card-meta">${articleMeta(entry)}</p>
<p class="article-card-title">${articleTitle(entry)}</p>
${item.line ? `<p class="roundup-line">${escapeHtml(item.line)}</p>` : ''}
</div>`;
    })
    .filter(Boolean);
  if (!items.length) {
    return '';
  }
  return `<div class="roundup">${items.join('')}<p class="roundup-footer">${items.length} link${items.length === 1 ? '' : 's'}</p></div>`;
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
