import {
  NETWORK_LIMITS,
  countCharacters,
  escapeText,
  fingerprintPost,
  postParagraphs,
} from '../../../api/helpers/socialThreads.js';
import { processText } from '../../../backend/helpers/social.js';

const TEXT_BLOCKS = ['paragraph', 'quote', 'embed'];

const linkTo = (snapshot = {}) =>
  snapshot.href
    ? `<a href="${escapeText(snapshot.href).replace(/"/g, '&quot;')}">${escapeText(snapshot.title || snapshot.href)}</a>`
    : escapeText(snapshot.title || '');

/**
 * Blocks that become thread text, as paragraphs: article cards become a link to the article,
 * and each roundup item a link followed by your line. Tables and video/audio blocks aren't
 * cross-posted.
 * @param {Object[]} blocks
 */
function threadBlocks(blocks) {
  return blocks.flatMap((block) => {
    if (block.type === 'article') {
      return [
        { type: 'paragraph', data: { text: linkTo(block.data.snapshot) } },
      ];
    }
    if (block.type === 'roundup') {
      return (block.data.items || []).map((item) => ({
        type: 'paragraph',
        data: {
          text: [linkTo(item.snapshot), escapeText(item.line || '')]
            .filter(Boolean)
            .join(' — '),
        },
      }));
    }
    return [block];
  });
}

// One main-post block as thread text for a network: mentions become that network's handles,
// emphasis is dropped, and links stay links (written out later for networks without rich text).
function blockText(block, network, entities) {
  let text = block.type === 'embed' ? block.data.source : block.data.text;
  if (block.type === 'quote') {
    text = `"${text}"`;
  }
  const processed = processText(text || '', network, entities).text;
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
 * @param {Object} [entities] Mentioned entities by id, so mentions become this network's handles
 * @returns {Object} A thread, not yet edited
 */
export function buildThread(mainPost, network, tags = '', entities = {}) {
  const limit = NETWORK_LIMITS[network].post;
  const posts = [];
  let current = { text: '', media: [] };
  const finishPost = () => {
    if (current.text || current.media.length) {
      posts.push(current);
    }
    current = { text: '', media: [] };
  };

  for (const block of threadBlocks(mainPost.blocks || [])) {
    if (TEXT_BLOCKS.includes(block.type)) {
      const text = blockText(block, network, entities);
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
    } else if (block.type === 'gallery') {
      current.media.push(
        ...(block.data.files || []).map((file) => ({
          url: file.url,
          alt: file.alt || '',
        })),
      );
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
