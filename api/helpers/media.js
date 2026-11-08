import { readDate } from './blocks.js';
import { getUniqueId } from './uniqueId.js';

// Images and galleries. Each image keeps its own file, in a consistent frame. Underneath:
//  - its caption (in a gallery, "1/2 · caption" under each image)
//  - where it came from, from the imageSource tune: "screenshot · fcc.gov · archived page",
//    "from Tech Influence Watch · full size", "captured Nov 1"
//  - for screenshots, the alt text, since the picture is of words

const escapeHtml = (text) =>
  String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const getImageClass = (data) => {
  const classes = ['media-wrapper'];
  if (data.withBorder) {
    classes.push('bordered');
  }
  if (data.stretched) {
    classes.push('full-width');
  }
  if (data.withBackground) {
    classes.push('backgrounded');
  }
  if (data.white) {
    classes.push('invert-on-dark');
  }
  if (data.landscape) {
    classes.push('landscape');
  }
  return `class="${classes.join(' ')}"`;
};

const fileUrl = (data) =>
  data.file && data.file.url ? data.file.url : data.url;

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const link = (href, text) => `<a href="${escapeHtml(href)}">${text}</a>`;

/**
 * The line saying where an image came from, or '' when the tune is empty.
 * @param {Object} [source] block.tunes.imageSource: { sourceName, sourceUrl, screenshot, capturedAt }
 * @param {{archived?: Object, file?: string}} [options] archived: url -> Wayback copy
 */
export function imageSourceLine(source = {}, { archived = {}, file } = {}) {
  const { sourceName, sourceUrl, screenshot, capturedAt } = source;
  const name = escapeHtml(sourceName || hostOf(sourceUrl));
  const named = name && sourceUrl ? link(sourceUrl, name) : name;
  const archive = sourceUrl ? archived[sourceUrl] : null;
  const parts = [
    screenshot ? 'screenshot' : null,
    named ? (screenshot ? named : `from ${named}`) : null,
    capturedAt ? `captured ${escapeHtml(readDate(capturedAt))}` : null,
    archive ? link(archive, screenshot ? 'archived page' : 'archived') : null,
    named && !screenshot && file ? link(file, 'full size') : null,
  ].filter(Boolean);
  return parts.length ? `<p class="media-source">${parts.join(' · ')}</p>` : '';
}

/**
 * The same, for an image beside something in a comparison: "Reuters · Nov 1 · original ·
 * archived" (the source, when it was captured, and links to the page and its archived copy).
 * @param {Object} [source] block.tunes.imageSource
 * @param {{archived?: Object}} [options]
 */
export function comparisonSourceLine(source = {}, { archived = {} } = {}) {
  const { sourceName, sourceUrl, capturedAt } = source;
  const parts = [
    escapeHtml(sourceName || hostOf(sourceUrl)),
    capturedAt ? escapeHtml(readDate(capturedAt)) : null,
    sourceUrl ? link(sourceUrl, 'original') : null,
    sourceUrl && archived[sourceUrl]
      ? link(archived[sourceUrl], 'archived')
      : null,
  ].filter(Boolean);
  return parts.length ? `<p class="media-source">${parts.join(' · ')}</p>` : '';
}

const mediaElement = (data, galleryId) => {
  const source = fileUrl(data);
  const alt = escapeHtml(
    data.alt ||
      (data.file?.contentType?.startsWith('video/') ? 'Video' : 'Image'),
  );
  if (
    data.file?.contentType?.startsWith('video/') ||
    data.contentType?.startsWith('video/')
  ) {
    return `<video controls preload="metadata" src="${escapeHtml(source)}" aria-label="${alt}"></video>`;
  }
  return `<a href="${escapeHtml(source)}" data-fslightbox="${galleryId || getUniqueId(10)}"><img src="${escapeHtml(source)}" alt="${alt}" loading="lazy" /></a>`;
};

/** One image (or video file) block. inComparison: it's one side of a comparison. */
export const formatMedia = ({ data, tunes, archived, inComparison }) => {
  if (!data) {
    return '';
  }
  const source = tunes?.imageSource || {};
  const caption = data.caption
    ? `<figcaption>${data.caption}</figcaption>`
    : '';
  const sourceLine = inComparison
    ? comparisonSourceLine(source, { archived })
    : imageSourceLine(source, { archived, file: fileUrl(data) });
  // A screenshot's alt text goes under it, since it's a picture of words; not in a comparison,
  // where the label and the other side already say what it is
  const alt =
    source.screenshot && data.alt && !inComparison
      ? `<p class="media-alt">${escapeHtml(data.alt).replace(/\n/g, '<br>')}</p>`
      : '';
  return `<figure ${getImageClass(data)}>${mediaElement(data)}${caption}${sourceLine}${alt}</figure>`;
};

/** A gallery: images side by side, each with its own caption, then the gallery's. */
export const formatGallery = ({ data, tunes, archived }) => {
  const galleryId = getUniqueId(10);
  const files = data.files || [];
  const images = files
    .map((file, index) => {
      const caption = file.caption
        ? `<figcaption>${files.length > 1 ? `${index + 1}/${files.length} · ` : ''}${file.caption}</figcaption>`
        : '';
      return `<figure ${getImageClass(file)}>${mediaElement(file, galleryId)}${caption}</figure>`;
    })
    .join('');
  const caption = data.caption
    ? `<p class="gallery-caption">${data.caption}</p>`
    : '';
  const sourceLine = imageSourceLine(tunes?.imageSource, { archived });
  return `<div class="media-gallery"><div class="media-wrapper-gallery">${images}</div>${caption}${sourceLine}</div>`;
};
