export const getSlugFromTitle = (title) => {
  return title
    .toLowerCase()
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '');
};

export const socialLinksToMap = (socialLinks) =>
  socialLinks.reduce((acc, link) => {
    acc[link.type] = link.postId;
    return acc;
  }, {});

export const socialLinksToArray = (socialLinks) =>
  Object.entries(socialLinks).map(([type, postId]) => ({ type, postId }));
