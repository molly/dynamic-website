import * as cheerio from 'cheerio';
import { DateTime } from 'luxon';
import { formatDuration, formatReadDate } from './blocks.js';
import { documentSide, joinNames } from './documentParties.js';
import { cleanHtml, escapeHtml } from './html.js';
import { NETWORK_LABELS } from './socialMedia.js';

// Site HTML for blocks that show primary sources: document excerpts, social post cards and
// threads, and side-by-side comparisons.

// Document ---------------------------------------------------------------------------------------
// Data: { docType: 'filing' | 'letter' | 'other', title, date, paragraph, excerptHtml
// (<mark> for "highlight mine"), pdfUrl, pdfPage, docketUrl, thumbnail, coverageUrl, entity,
// senders, recipients, display: 'highlights' | 'full' } (senders and recipients: see
// documentParties.js). The excerpt is stored whole; with display 'highlights' (the default) only
// its highlighted passages show, with "…" where text is left out. 'full' shows it all, with the
// highlights marked, but only on the post's own page (preparePostForDisplay sets `fullPassage`);
// the feed always shows highlights only.

const EXCERPT_TAGS = ['a', 'br', 'mark', 'b', 'strong', 'i', 'em'];

const link = (href, text) =>
  href ? `<a href="${escapeHtml(href)}">${escapeHtml(text)}</a>` : '';

const domainOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const PDF_LABELS = {
  filing: 'PDF',
  letter: 'full letter (PDF)',
  other: 'full document (PDF)',
};

const pdfHref = ({ pdfUrl, pdfPage }) =>
  pdfUrl && pdfPage ? `${pdfUrl}#page=${pdfPage}` : pdfUrl;

/**
 * Just the highlighted passages of an excerpt, with "…" wherever text is left out: before, between
 * and after them. Null if nothing is highlighted.
 * @param {string} html Clean excerpt HTML
 * @returns {?string}
 */
export function highlightsOnly(html) {
  const $ = cheerio.load(html, null, false);
  if (!$('mark').length) {
    return null;
  }
  const parts = [];
  let skipped = false;
  const walk = (nodes) => {
    for (const node of nodes) {
      if (node.type === 'tag' && node.name === 'mark') {
        if (skipped) {
          parts.push('…');
        }
        parts.push($.html(node));
        skipped = false;
      } else if (node.type === 'text') {
        skipped = skipped || /\S/.test(node.data);
      } else if (node.children) {
        walk(node.children);
      }
    }
  };
  walk($.root()[0].children);
  if (skipped) {
    parts.push('…');
  }
  return parts.join(' ');
}

export function renderDocument({ data, archived = {}, fullPassage = false }) {
  const isFiling = data.docType === 'filing';
  const paragraph = String(data.paragraph || '').trim();
  const whole = cleanHtml(data.excerptHtml, EXCERPT_TAGS);
  const highlights = whole.includes('<mark>') ? highlightsOnly(whole) : null;
  const pdf = pdfHref(data);

  const title = [data.title, isFiling && paragraph ? `¶${paragraph}` : null]
    .filter(Boolean)
    .map(escapeHtml)
    .join(' · ');
  // Senders and recipients that are entities show in bold, linked to them (each person's `html`,
  // made when mentions are expanded); others as the name written. A lone person's descriptor
  // follows a comma ("Howard Lutnick, Secretary of Commerce"); in a list it's in parentheses.
  const party = (key) => {
    const { prefix, people, more } = documentSide(data, key);
    const alone = people.length === 1 && !more;
    const names = people
      .map(({ name, role, html }) => {
        // Someone saved only as an entity that's since been deleted has no name to show
        const shown = html || escapeHtml(name);
        if (!shown || !role) {
          return shown;
        }
        return alone
          ? `${shown}, ${escapeHtml(role)}`
          : `${shown} (${escapeHtml(role)})`;
      })
      .filter(Boolean);
    const list = joinNames(names, more);
    return list && prefix ? `${escapeHtml(prefix)} ${list}` : list;
  };
  // "Oct 8, 2026 → Brandon Lutnick, Cantor Fitzgerald", then "from Senate PSI (minority)"
  const senders = party('senders');
  const recipients = party('recipients');
  const meta = [
    data.date
      ? `<strong class="document-date">${escapeHtml(formatReadDate(data.date))}</strong>`
      : '',
    recipients ? `→ ${recipients}` : '',
  ]
    .filter(Boolean)
    .join(' ');
  // The title shows for a filing (the case) or a document with nobody named on it; a letter is
  // known by who sent it to whom.
  const showTitle = title && (isFiling || (!senders && !recipients));
  // Under the excerpt: the links to the document, then the notes on it
  const notes = [
    link(pdf, PDF_LABELS[data.docType] || PDF_LABELS.other),
    link(archived[data.pdfUrl], 'archived'),
    link(data.docketUrl, 'docket'),
    highlights
      ? whole.match(/<mark>/g).length > 1
        ? 'highlights mine'
        : 'highlight mine'
      : null,
    pdf && paragraph ? link(pdf, `jump to ¶${paragraph} in PDF`) : null,
    data.coverageUrl
      ? `my coverage: ${link(data.coverageUrl, domainOf(data.coverageUrl))}`
      : null,
  ].filter(Boolean);

  const thumbnail = data.thumbnail
    ? `<a class="document-thumbnail" href="${escapeHtml(pdf || data.thumbnail)}"><img src="${escapeHtml(data.thumbnail)}" alt="${escapeHtml(`First page of ${data.title || 'the document'}`)}" loading="lazy"></a>`
    : '';
  const excerptBlock = (html, mode) => {
    const className = [
      'document-excerpt',
      isFiling && paragraph ? 'numbered' : null,
      mode,
    ]
      .filter(Boolean)
      .join(' ');
    return isFiling && paragraph
      ? `<div class="${className}"><span class="document-paragraph">${escapeHtml(paragraph)}.</span><div>${html}</div></div>`
      : `<div class="${className}">${html}</div>`;
  };
  let body = '';
  if (highlights && !fullPassage) {
    // The full passage comes along unshown, for the "show full passage" button site.js adds.
    // (A template's content isn't displayed, and feed readers drop it.)
    body = `${excerptBlock(highlights, 'highlights-only')}<template class="document-full-passage">${excerptBlock(whole, 'with-highlights')}</template>`;
  } else if (whole) {
    body = excerptBlock(whole, highlights ? 'with-highlights' : null);
  }

  return `<figure class="document-block ${escapeHtml(data.docType || 'other')}${thumbnail ? ' with-thumbnail' : ''}">
${thumbnail}<div class="document-main">
${showTitle ? `<header class="document-head"><span class="document-title">${title}</span></header>` : ''}
${meta ? `<p class="document-meta">${meta}</p>` : ''}${senders ? `<p class="document-from">from ${senders}</p>` : ''}${body}${notes.length ? `<p class="document-notes">${notes.join(' · ')}</p>` : ''}
</div></figure>`;
}

// Social posts -----------------------------------------------------------------------------------
// Data: { posts: [post], screenshot } where a post is as backend/helpers/socialFetch.js describes.
// One post is a card; more are a thread.

const postedTime = (iso, format = 'h:mm a · LLL d, yyyy') => {
  const dt = DateTime.fromISO(String(iso || ''), { zone: 'America/New_York' });
  return dt.isValid ? dt.toFormat(format) : '';
};

// A post's time in Eastern, marked so the reader's browser shows it in their own zone
// (api/helpers/localTimes.js).
const postedTimeTag = (iso, localFormat, format) => {
  const text = postedTime(iso, format);
  return text
    ? `<time datetime="${escapeHtml(String(iso))}" data-local="${localFormat}">${escapeHtml(text)}</time>`
    : '';
};

function renderSocialMedia(media = [], screenshot) {
  if (!media.length) {
    return '';
  }
  const items = media.map((item) => {
    if (!item.saved || !item.src) {
      const see = screenshot ? ` · ${link(screenshot, 'see screenshot')}` : '';
      return `<p class="social-media-missing">${item.type === 'video' ? 'Video' : 'Image'} not archived${see}</p>`;
    }
    if (item.type === 'video') {
      return `<div class="social-video"><video controls preload="metadata" src="${escapeHtml(item.src)}"${item.poster ? ` poster="${escapeHtml(item.poster)}"` : ''}${item.alt ? ` aria-label="${escapeHtml(item.alt)}"` : ''}></video>${item.duration ? `<span class="social-duration">${formatDuration(item.duration)}</span>` : ''}</div>`;
    }
    return `<a class="social-image" href="${escapeHtml(item.src)}"><img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt || '')}" loading="lazy"></a>`;
  });
  return `<div class="social-media count-${Math.min(media.length, 4)}">${items.join('')}</div>`;
}

const authorLine = (post) =>
  `<span class="social-author"><strong>${escapeHtml(post.authorName || '')}</strong> ${
    post.handle
      ? post.profileUrl
        ? `<a href="${escapeHtml(post.profileUrl)}">@${escapeHtml(post.handle)}</a>`
        : `@${escapeHtml(post.handle)}`
      : ''
  }</span>`;

// A post's text keeps its links and line breaks, and your highlights ("highlight mine")
const POST_TEXT_TAGS = ['a', 'br', 'mark'];

// A post's text, its blank lines made paragraphs (with less space than an empty line). One that's
// only part of the post fades out, with a note for screen readers.
function postText(post) {
  const paragraphs = cleanHtml(post.textHtml, POST_TEXT_TAGS)
    .split(/(?:\s*<br>\s*){2,}/)
    .filter((p) => p.trim())
    .map((p) => `<p>${p}</p>`)
    .join('');
  return post.partial
    ? `<div class="social-text social-text-partial">${paragraphs}<span class="social-excerpt-note"> (excerpt)</span></div>`
    : `<div class="social-text">${paragraphs}</div>`;
}

// How many highlights the posts on a card (and the posts they quote) have
const highlightCount = (posts) =>
  posts
    .flatMap((post) => [post.textHtml, post.quoted?.textHtml])
    .reduce(
      (n, text) => n + (String(text || '').match(/<mark>/g) || []).length,
      0,
    );

function renderPostBody(post, screenshot) {
  const card = post.linkCard?.url
    ? `<a class="social-link-card" href="${escapeHtml(post.linkCard.url)}"><span class="social-link-domain">${escapeHtml(post.linkCard.domain || '')}</span><span class="social-link-title">${escapeHtml(post.linkCard.title || post.linkCard.url)}</span></a>`
    : '';
  const quoted = post.quoted
    ? `<div class="social-quoted"><p class="social-head">${authorLine(post.quoted)}</p>${postText(post.quoted)}${renderSocialMedia(post.quoted.media, screenshot)}</div>`
    : '';
  return `${postText(post)}${renderSocialMedia(post.media, screenshot)}${card}${quoted}`;
}

// The card's last line: when it was posted (single posts; a thread dates each post) on the left,
// and the original, archived and screenshot links on the right.
function cardFooter(
  originalUrl,
  screenshot,
  archived = {},
  when = '',
  { highlights = 0 } = {},
) {
  const links = [
    link(originalUrl, 'original'),
    link(archived[originalUrl], 'archived'),
    link(screenshot, 'screenshot'),
    highlights ? (highlights > 1 ? 'highlights mine' : 'highlight mine') : '',
  ]
    .filter(Boolean)
    .join(' · ');
  if (!links && !when) {
    return '';
  }
  return `<p class="social-footer">${when ? `<span class="social-when">${when}</span>` : ''}${links ? `<span class="social-links">${links}</span>` : ''}</p>`;
}

export function renderSocialPost({ data, archived = {} }) {
  const posts = data.posts || [];
  if (!posts.length) {
    return '';
  }
  const network = NETWORK_LABELS[posts[0].network] || '';
  if (posts.length === 1) {
    const [post] = posts;
    const when = postedTimeTag(post.postedAt, 'date', 'LLL d, yyyy');
    return `<figure class="social-card network-${escapeHtml(post.network)}">
<header class="social-head">${authorLine(post)}<span class="social-network">${escapeHtml(network)}</span></header>
${renderPostBody(post, data.screenshot)}
${cardFooter(post.originalUrl, data.screenshot, archived, when, { highlights: highlightCount(posts) })}
</figure>`;
  }
  // A thread is a reply chain: each post replies to the one before. "replying to @…" shows where
  // the author changes, not where someone continues their own thread (as on x.com).
  const items = posts
    .map((post, i) => {
      const date = postedTimeTag(post.postedAt, 'monthDay', 'LLL d');
      const dated = date
        ? ` · ${post.originalUrl ? `<a href="${escapeHtml(post.originalUrl)}">${date}</a>` : date}`
        : '';
      const previous = posts[i - 1];
      const replyingTo =
        previous?.handle && previous.handle !== post.handle
          ? `<p class="social-replying">replying to ${
              previous.profileUrl
                ? `<a href="${escapeHtml(previous.profileUrl)}">@${escapeHtml(previous.handle)}</a>`
                : `@${escapeHtml(previous.handle)}`
            }</p>`
          : '';
      return `<li class="social-thread-post"><p class="social-thread-head">${authorLine(post)}${dated}</p>${replyingTo}${renderPostBody(post, data.screenshot)}</li>`;
    })
    .join('');
  return `<figure class="social-card social-thread network-${escapeHtml(posts[0].network)}">
<header class="social-head"><span class="social-thread-count">Thread · ${posts.length} posts</span><span class="social-network">${escapeHtml(network)}</span></header>
<ol class="social-thread-posts">${items}</ol>
${cardFooter(posts[0].originalUrl, data.screenshot, archived, '', { highlights: highlightCount(posts) })}
</figure>`;
}

// Comparison -------------------------------------------------------------------------------------
// Data: { left: { label, block: { type, data } }, right: { … } }

/**
 * @param {{data: Object}} block
 * @param {(block: Object) => string} renderBlock Renders the block inside each side
 */
export function renderComparison({ data }, renderBlock) {
  const side = (slot) =>
    slot?.block
      ? `<div class="comparison-side">${slot.label ? `<p class="comparison-label">${escapeHtml(slot.label)}</p>` : ''}${renderBlock(slot.block) || ''}</div>`
      : '';
  return `<div class="comparison">${side(data.left)}${side(data.right)}</div>`;
}
