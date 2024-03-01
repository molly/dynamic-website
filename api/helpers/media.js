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

  return `class="${classes.join(' ')}"`;
};

const getAltText = (alt, fallback) => {
  if (alt) {
    return alt.replace(/"/g, '&quot;');
  }
  return fallback;
};

export const formatMedia = ({ data }) => {
  const source = data.file && data.file.url ? data.file.url : data.url;
  const classes = getImageClass(data);
  if (data.file?.contentType?.startsWith('video/')) {
    return `<div ${classes}><video controls src="${source}" alt="${getAltText(data.alt, 'Video')}" /></div>`;
  }
  return `<div ${classes}><img src="${source}" alt="${getAltText(data.alt, 'Image')}" /></div>`;
};
