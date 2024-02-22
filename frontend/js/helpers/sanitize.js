export const sanitizeTag = (tag) =>
  tag
    .toLowerCase()
    .replace(/[- ]/g, '_')
    .replace(/[^a-z0-9_]/g, '');
