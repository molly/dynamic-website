import { getUniqueId } from './uniqueId.js';

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

const getAltText = (alt, fallback) => {
  if (alt) {
    return alt.replace(/"/g, '&quot;');
  }
  return fallback;
};

export const formatMedia = ({ data }, galleryId = null) => {
  if (data) {
    const source = data.file && data.file.url ? data.file.url : data.url;
    const classes = getImageClass(data);
    let media;

    // Create media element
    if (data.file?.contentType?.startsWith('video/')) {
      media = `<video controls src="${source}" alt="${getAltText(data.alt, 'Video')}" />`;
    }
    media = `<img src="${source}" alt="${getAltText(data.alt, 'Image')}" />`;

    // Add lightbox
    media = `<a href="${source}" data-fslightbox=${galleryId || getUniqueId(10)}>${media}</a>`;

    // Return with wrapper div
    return `<div ${classes}>${media}</div>`;
  }
};

export const formatGallery = ({ data }) => {
  let html = `<figure class="media-wrapper media-wrapper-gallery">`;
  const galleryId = getUniqueId(10);
  for (let file of data.files) {
    html += formatMedia({ data: file }, galleryId);
  }
  if (data.caption) {
    html += `<figcaption>${data.caption}</figcaption>`;
  }
  html += `</figure>`;
  return html;
};
