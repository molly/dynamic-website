const getImageClass = (data) => {
  const classes = [];

  if (data.classes) {
    classes.push(data.classes);
  }
  if (data.withBorder) {
    classes.push('bordered');
  }
  if (data.stretched) {
    classes.push('full-width');
  }
  if (data.withBackground) {
    classes.push('backgrounded');
  }

  if (classes.length) {
    return `class="${classes.join(' ')}"`;
  }
  return '';
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
    return `<video controls ${classes} src="${source}" alt="${getAltText(data.alt, 'Video')}" />`;
  }
  return `<img ${classes} src="${source}" alt="${getAltText(data.alt, 'Image')}" />`;
};
