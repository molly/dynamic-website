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

// tight: joined to the paragraph before with a line break rather than a blank line (list items,
// gallery captions)
const paragraph = (text, { tight = false } = {}) => ({
  type: 'paragraph',
  data: { text, tight },
});

// Blocks that aren't cross-posted: what the platform tabs say is left out
const LEFT_OUT = {
  raw: { one: 'an HTML block', many: 'HTML blocks' },
  table: { one: 'a table', many: 'tables' },
  video: { one: 'a video', many: 'videos' },
  audio: { one: 'an audio file', many: 'audio files' },
};
const leftOutKind = (block) =>
  block.type === 'media'
    ? block.data?.kind === 'audio'
      ? 'audio'
      : 'video'
    : LEFT_OUT[block.type]
      ? block.type
      : null;

/**
 * What in the main post isn't cross-posted, for the platform tabs to say: "a table", "2 videos".
 * @param {{blocks: Object[]}} mainPost
 * @returns {string[]}
 */
export function leftOutOfThreads(mainPost) {
  const counts = new Map();
  for (const block of mainPost.blocks || []) {
    const kind = leftOutKind(block);
    if (kind) {
      counts.set(kind, (counts.get(kind) || 0) + 1);
    }
  }
  return [...counts].map(([kind, n]) =>
    n === 1 ? LEFT_OUT[kind].one : `${n} ${LEFT_OUT[kind].many}`,
  );
}

/**
 * Blocks that become thread text, as paragraphs: headings as their own paragraph, list items one
 * per line ("• " or "1. "), code as plain text, article cards a link to the article, each roundup
 * item a link followed by your line, a document a link to its PDF, and a social post a link to it
 * (by name, not @handle, so it doesn't notify them). Images and galleries are followed by their
 * captions, as on the site. A comparison's two sides are each treated this way, after their
 * labels. Raw HTML, tables and video/audio aren't cross-posted (leftOutOfThreads).
 * @param {Object[]} blocks
 */
function threadBlocks(blocks) {
  return blocks.flatMap((block) => {
    if (leftOutKind(block)) {
      return [];
    }
    if (block.type === 'header') {
      return [paragraph(block.data.text || '')];
    }
    if (block.type === 'list') {
      const ordered = block.data.style === 'ordered';
      return (block.data.items || []).map((item, index) =>
        paragraph(`${ordered ? `${index + 1}.` : '•'} ${item}`, {
          tight: index > 0,
        }),
      );
    }
    if (block.type === 'code') {
      return [paragraph(block.data.code || '')];
    }
    if (block.type === 'image') {
      return [
        block,
        ...(block.data.caption ? [paragraph(block.data.caption)] : []),
      ];
    }
    if (block.type === 'gallery') {
      const files = block.data.files || [];
      const captions = files
        .map((file, index) =>
          file.caption
            ? files.length > 1
              ? `${index + 1}/${files.length} · ${file.caption}`
              : file.caption
            : null,
        )
        .filter(Boolean)
        .map((text, index) => paragraph(text, { tight: index > 0 }));
      return [
        block,
        ...captions,
        ...(block.data.caption ? [paragraph(block.data.caption)] : []),
      ];
    }
    if (block.type === 'document') {
      const { title, pdfUrl, docketUrl } = block.data;
      return [
        paragraph(
          linkTo({ href: pdfUrl || docketUrl, title: title || 'Document' }),
        ),
      ];
    }
    if (block.type === 'socialPost') {
      const [first] = block.data.posts || [];
      if (!first) {
        return [];
      }
      const posts = block.data.posts.length;
      const name = `${first.authorName || 'Post'}’s ${posts > 1 ? 'thread' : 'post'}`;
      return [paragraph(linkTo({ href: first.originalUrl, title: name }))];
    }
    if (block.type === 'comparison') {
      return [block.data.left, block.data.right].flatMap((slot) => {
        if (!slot?.block) {
          return [];
        }
        const inner = threadBlocks([slot.block]);
        if (!slot.label) {
          return inner;
        }
        const label = escapeText(slot.label);
        return TEXT_BLOCKS.includes(inner[0]?.type) && inner[0].type !== 'embed'
          ? [
              {
                ...inner[0],
                data: {
                  ...inner[0].data,
                  text: `${label}: ${inner[0].data.text}`,
                },
              },
              ...inner.slice(1),
            ]
          : [paragraph(label), ...inner];
      });
    }
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
// A quote is in quotation marks, followed by who said it.
function blockText(block, network, entities) {
  let text = block.type === 'embed' ? block.data.source : block.data.text;
  if (block.type === 'quote') {
    text = `"${text}"${block.data.caption ? ` — ${block.data.caption}` : ''}`;
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
      const separator = block.data?.tight ? '<br>' : '<br><br>';
      const combined = current.text
        ? `${current.text}${separator}${text}`
        : text;
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
