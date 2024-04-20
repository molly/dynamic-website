import debounce from 'lodash.debounce';
import { processText } from '../../../backend/helpers/social.js';

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

export const NETWORK_LIMITS = {
  twitter: { post: 280, alt: 1000 },
  mastodon: { post: 500, alt: 1500 },
  bluesky: { post: 300, alt: 1000 },
};

export const createSocialBlock = (block, network) => {
  const newBlock = JSON.parse(JSON.stringify(block));
  let text = block.data.text;
  if (block.type === 'quote') {
    text = `"${text}"`;
  }
  newBlock.data.text = processText(text, network).text;
  newBlock.type = 'paragraph';
  return newBlock;
};

export const parseAndInsertDelimiters = (post, network) => {
  let charCount = 0;
  let images = [];
  const newPostBlocks = [];
  for (let i = 0; i < post.blocks.length; i++) {
    const currentBlock = post.blocks[i];
    if (currentBlock.type === 'paragraph' || currentBlock.type === 'quote') {
      const newBlock = createSocialBlock(currentBlock, network);
      let currentBlockLength = newBlock.data.text.length;
      if (network === 'bluesky') {
        // For bluesky posts, the character count is the length of the plain text rather than the richtext
        currentBlockLength = processText(currentBlock.data.text, network)
          .plainText.length;
      }

      if (
        newPostBlocks.length > 0 &&
        charCount + currentBlockLength > NETWORK_LIMITS[network].post
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
        newPostBlocks.push(newBlock);
        charCount = currentBlockLength;
      } else {
        // Start a new post
        newPostBlocks.push(newBlock);
        charCount += currentBlockLength;
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
      const processed = processText(block.data.text, network);
      if (network === 'bluesky') {
        // For bluesky posts, the character count is the length of the plain text rather than the richtext
        charCount += processed.plainText.length;
      } else {
        charCount = processed.text.length;
      }
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
