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
  Object.entries(socialLinks)
    .filter(([_, postId]) => postId != undefined)
    .map(([type, postId]) => ({ type, postId }));

export const mergeSocialLinks = (oldLinks, newLinks) => {
  const oldLinksCopy = JSON.parse(JSON.stringify(oldLinks));
  for (let link of newLinks) {
    const oldLinkIndex = oldLinks.findIndex((e) => e.type === link.type);
    if (oldLinkIndex !== -1) {
      oldLinksCopy[oldLinkIndex].postId = link.postId;
    } else {
      oldLinksCopy.push(link);
    }
  }
  return oldLinksCopy;
};
