import { DateTime } from 'luxon';
import { formatDuration, formatReadDate } from './blocks.js';
import { cleanHtml, escapeHtml } from './html.js';
import { NETWORK_LABELS } from './socialMedia.js';

// Site HTML for blocks that show primary sources: document excerpts, social post cards and
// threads, and side-by-side comparisons.

// Document ---------------------------------------------------------------------------------------
// Data: { docType: 'filing' | 'letter' | 'other', title, date, from, to, paragraph, excerptHtml
// (<mark> for "highlight mine"), pdfUrl, pdfPage, docketUrl, thumbnail, coverageUrl, entity }

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

const pdfHref = ({ pdfUrl, pdfPage }) =>
  pdfUrl && pdfPage ? `${pdfUrl}#page=${pdfPage}` : pdfUrl;

export function renderDocument({ data }) {
  const isFiling = data.docType === 'filing';
  const paragraph = String(data.paragraph || '').trim();
  const excerpt = cleanHtml(data.excerptHtml, EXCERPT_TAGS);
  const pdf = pdfHref(data);

  const title = [data.title, isFiling && paragraph ? `¶${paragraph}` : null]
    .filter(Boolean)
    .map(escapeHtml)
    .join(' · ');
  const meta = [
    formatReadDate(data.date),
    [data.from, data.to].filter(Boolean).join(' → '),
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join(' · ');
  const sourceLinks = [
    link(pdf, isFiling ? 'PDF' : 'full document (PDF)'),
    link(data.docketUrl, 'docket'),
  ]
    .filter(Boolean)
    .join(' · ');
  const notes = [
    excerpt.includes('<mark>') ? 'highlight mine' : null,
    pdf && paragraph ? link(pdf, `jump to ¶${paragraph} in PDF`) : null,
    data.coverageUrl
      ? `my coverage: ${link(data.coverageUrl, domainOf(data.coverageUrl))}`
      : null,
  ].filter(Boolean);

  const thumbnail = data.thumbnail
    ? `<a class="document-thumbnail" href="${escapeHtml(pdf || data.thumbnail)}"><img src="${escapeHtml(data.thumbnail)}" alt="${escapeHtml(`First page of ${data.title || 'the document'}`)}" loading="lazy"></a>`
    : '';
  const body = excerpt
    ? isFiling && paragraph
      ? `<div class="document-excerpt numbered"><span class="document-paragraph">${escapeHtml(paragraph)}.</span><div>${excerpt}</div></div>`
      : `<div class="document-excerpt">${excerpt}</div>`
    : '';

  return `<figure class="document-block ${escapeHtml(data.docType || 'other')}${thumbnail ? ' with-thumbnail' : ''}">
${thumbnail}<div class="document-main">
<header class="document-head"><span class="document-title">${title}</span>${sourceLinks ? `<span class="document-links">${sourceLinks}</span>` : ''}</header>
${meta ? `<p class="document-meta">${meta}</p>` : ''}${body}${notes.length ? `<p class="document-notes">${notes.join(' · ')}</p>` : ''}
</div></figure>`;
}

// Social posts -----------------------------------------------------------------------------------
// Data: { posts: [post], screenshot } where a post is as backend/helpers/socialFetch.js describes.
// One post is a card; more are a thread.

const postedTime = (iso, format = 'h:mm a · LLL d, yyyy') => {
  const dt = DateTime.fromISO(String(iso || ''), { zone: 'America/New_York' });
  return dt.isValid ? dt.toFormat(format) : '';
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
    return `<a class="social-image" href="${escapeHtml(item.src)}"><img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.alt || '')}" loading="lazy">${item.alt ? '<span class="alt-badge" aria-hidden="true">ALT</span>' : ''}</a>`;
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

function renderPostBody(post, screenshot) {
  const card = post.linkCard?.url
    ? `<a class="social-link-card" href="${escapeHtml(post.linkCard.url)}"><span class="social-link-domain">${escapeHtml(post.linkCard.domain || '')}</span><span class="social-link-title">${escapeHtml(post.linkCard.title || post.linkCard.url)}</span></a>`
    : '';
  const quoted = post.quoted
    ? `<div class="social-quoted"><p class="social-head">${authorLine(post.quoted)}</p><div class="social-text">${cleanHtml(post.quoted.textHtml)}</div>${renderSocialMedia(post.quoted.media, screenshot)}</div>`
    : '';
  return `<div class="social-text">${cleanHtml(post.textHtml)}</div>${renderSocialMedia(post.media, screenshot)}${card}${quoted}`;
}

function cardFooter(originalUrl, screenshot) {
  const links = [link(originalUrl, 'original'), link(screenshot, 'screenshot')]
    .filter(Boolean)
    .join(' · ');
  return links ? `<p class="social-footer">${links}</p>` : '';
}

export function renderSocialPost({ data }) {
  const posts = data.posts || [];
  if (!posts.length) {
    return '';
  }
  const network = NETWORK_LABELS[posts[0].network] || '';
  if (posts.length === 1) {
    const [post] = posts;
    const when = postedTime(post.postedAt);
    return `<figure class="social-card network-${escapeHtml(post.network)}">
<header class="social-head">${authorLine(post)}<span class="social-network">${escapeHtml(network)}</span></header>
${renderPostBody(post, data.screenshot)}
${when ? `<p class="social-meta">${escapeHtml(when)}</p>` : ''}${cardFooter(post.originalUrl, data.screenshot)}
</figure>`;
  }
  const items = posts
    .map((post) => {
      const date = postedTime(post.postedAt, 'LLL d');
      return `<li class="social-thread-post"><p class="social-thread-head">${authorLine(post)}${date ? ` · <a href="${escapeHtml(post.originalUrl || '')}">${escapeHtml(date)}</a>` : ''}</p>${renderPostBody(post, data.screenshot)}</li>`;
    })
    .join('');
  return `<figure class="social-card social-thread network-${escapeHtml(posts[0].network)}">
<header class="social-head"><span>Thread · ${posts.length} posts</span><span class="social-network">${escapeHtml(network)}</span></header>
<ol class="social-thread-posts">${items}</ol>
${cardFooter(posts[0].originalUrl, data.screenshot)}
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
