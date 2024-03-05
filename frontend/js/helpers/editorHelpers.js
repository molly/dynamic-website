import debounce from 'lodash.debounce';

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

export const NETWORK_LIMITS = {
  twitter: { post: 280, alt: 1000 },
  mastodon: { post: 500, alt: 1500 },
  bluesky: { post: 300, alt: 1000 },
};

export const insertDelimiters = (post, network) => {
  let charCount = 0;
  let images = [];
  const newPostBlocks = [];
  for (let i = 0; i < post.blocks.length; i++) {
    const currentBlock = post.blocks[i];
    if (currentBlock.type === 'paragraph') {
      if (
        charCount + currentBlock.data.text.length >
        NETWORK_LIMITS[network].post
      ) {
        // End the current post and start a new one
        newPostBlocks.push(...images);
        images = [];
        newPostBlocks.push({
          type: 'socialPostDelimiter',
          data: {
            characterCount: charCount,
            limitExceeded: charCount > NETWORK_LIMITS[network].post,
          },
        });
        newPostBlocks.push(currentBlock);
        charCount = currentBlock.data.text.length;
      } else {
        // Add to the current post
        if (newPostBlocks.length > 0) {
          charCount += 2; // Add two characters for the newlines
        }
        newPostBlocks.push(currentBlock);
        charCount += currentBlock.data.text.length;
      }
    } else if (currentBlock.type === 'socialPostDelimiter') {
      // Manual post break
      newPostBlocks.push(...images);
      newPostBlocks.push({
        type: 'socialPostDelimiter',
        data: {
          characterCount: charCount,
          limitExceeded: charCount > NETWORK_LIMITS[network].post,
        },
      });
      images = [];
      charCount = 0;
    } else if (currentBlock.type === 'image') {
      images.push(currentBlock);
    }
  }
  // Add remaining images at the end, along with a final delimiter
  newPostBlocks.push(...images);
  newPostBlocks.push({
    type: 'socialPostDelimiter',
    data: {
      characterCount: charCount,
      limitExceeded: charCount > NETWORK_LIMITS[network].post,
    },
  });
  return { ...post, blocks: newPostBlocks };
};

export const updateDelimiters = (editor, post, network, tags = null) => {
  let canSave = true;
  // For mastodon posts, tags will be added to each post, so increment character count by that amount +1 for the newline
  let charCount = tags ? tags.length + 1 : 0;
  for (let block of post.blocks) {
    if (block.type === 'paragraph') {
      charCount += block.data.text.length;
    } else if (block.type === 'socialPostDelimiter') {
      if (charCount !== block.data.characterCount) {
        const limitExceeded = charCount > NETWORK_LIMITS[network].post;
        editor.blocks.update(block.id, {
          characterCount: charCount,
          limitExceeded,
        });
        if (limitExceeded) {
          canSave = false;
        }
      }
      charCount = tags ? tags.length + 1 : 0;
    }
  }
  return canSave;
};
export const debouncedUpdateDelimiters = debounce(updateDelimiters, 500);
