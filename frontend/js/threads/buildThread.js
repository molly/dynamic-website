import {
  NETWORK_LIMITS,
  countCharacters,
  escapeText,
  fingerprintPost,
  postParagraphs,
} from '../../../api/helpers/socialThreads.js';
import { processText } from '../../../backend/helpers/social.js';

const TEXT_BLOCKS = ['paragraph', 'quote', 'embed'];

// One main-post block as thread text for a network: mentions become that network's handles,
// emphasis is dropped, and links stay links (written out later for networks without rich text).
function blockText(block, network) {
  let text = block.type === 'embed' ? block.data.source : block.data.text;
  if (block.type === 'quote') {
    text = `"${text}"`;
  }
  const processed = processText(text || '', network).text;
  const html = network === 'bluesky' ? processed : escapeText(processed);
  return html.trim().replace(/\n/g, '<br>');
}

/**
 * Split the main post into a thread for one network. Paragraphs fill a post until the next one
 * would go over the limit; a manual post break in the main post always starts a new post; images
 * stay with the post they appear in.
 * @param {{blocks: Object[]}} mainPost EditorJS data
 * @param {string} network
 * @param {string} [tags] Mastodon tags, which count against every post
 * @returns {Object} A thread, not yet edited
 */
export function buildThread(mainPost, network, tags = '') {
  const limit = NETWORK_LIMITS[network].post;
  const posts = [];
  let current = { text: '', media: [] };
  const finishPost = () => {
    if (current.text || current.media.length) {
      posts.push(current);
    }
    current = { text: '', media: [] };
  };

  for (const block of mainPost.blocks || []) {
    if (TEXT_BLOCKS.includes(block.type)) {
      const text = blockText(block, network);
      if (!text) {
        continue;
      }
      const combined = current.text ? `${current.text}<br><br>${text}` : text;
      if (current.text && countCharacters(combined, network, tags) > limit) {
        finishPost();
        current.text = text;
      } else {
        current.text = combined;
      }
    } else if (block.type === 'image') {
      current.media.push({
        url: block.data.file.url,
        alt: block.data.alt || '',
      });
    } else if (block.type === 'socialPostDelimiter') {
      finishPost();
    }
  }
  finishPost();

  return {
    posts,
    ...(network === 'mastodon' ? { tags } : {}),
    edited: false,
    basedOn: {
      hash: fingerprintPost(mainPost),
      paragraphs: postParagraphs(mainPost),
    },
  };
}
