// Per-platform threads (MicroEntry.socialThreads), shared by the editor, the server and tests.
//
// A thread is { posts: [{ text, media: [{ url, alt }] }], tags?, edited, basedOn }. A post's text
// is a small subset of HTML: plain text, <br> line breaks and <a href> links. Bluesky keeps links
// as rich text; the other platforms get them written out as "text (url)".

export const NETWORK_LIMITS = {
  twitter: { post: 280, alt: 1000 },
  mastodon: { post: 2263, alt: 1500 }, // hachyderm.io's limit
  bluesky: { post: 300, alt: 1000 },
};

// Images per post, on every platform.
export const MEDIA_LIMIT = 4;

// Twitter and Mastodon count every URL as this many characters, however long it is.
const LINK_LENGTH = 23;
const URL_PATTERN = /https?:\/\/[^\s<>"]+/g;

// How each platform counts, as shown in the editor.
export const NETWORK_RULES = {
  bluesky: 'link text counts, not the URL',
  mastodon: `links count as ${LINK_LENGTH} · tags are added to every post`,
  twitter: `links count as ${LINK_LENGTH}`,
};

const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

export function decodeEntities(text) {
  return text.replace(
    /&(amp|lt|gt|quot|#39|nbsp);/g,
    (entity) => ENTITIES[entity],
  );
}

export function escapeText(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const stripTags = (html) => html.replace(/<[^>]*>/g, '');
const LINK_PATTERN = /<a\s[^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

/**
 * Format Mastodon tags as typed ("crypto, #law") into what's appended to each post ("#crypto #law").
 * @param {string} tags
 * @returns {string}
 */
export function formatTags(tags) {
  return (tags || '')
    .split(/[,\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
    .join(' ');
}

/**
 * A post as the platform receives it. Bluesky gets HTML with only <a> links left (line breaks as
 * newlines), for its rich text; everything else gets plain text with links written out.
 * @param {string} html A post's text
 * @param {string} network
 * @returns {string}
 */
export function postToNetworkText(html, network) {
  const withNewlines = html.replace(/<br\s*\/?>/gi, '\n');
  if (network === 'bluesky') {
    return withNewlines.replace(/<(?!\/?a[\s>])[^>]*>/gi, '');
  }
  const linksWrittenOut = withNewlines.replace(
    LINK_PATTERN,
    (match, href, inner) => {
      const text = stripTags(inner);
      return decodeEntities(text) === decodeEntities(href)
        ? href
        : `${text} (${href})`;
    },
  );
  return decodeEntities(stripTags(linksWrittenOut));
}

/**
 * The text a reader sees, without markup: what Bluesky counts.
 * @param {string} html
 */
export function visibleText(html) {
  return decodeEntities(stripTags(html.replace(/<br\s*\/?>/gi, '\n')));
}

function graphemeCount(text) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    return [...new Intl.Segmenter().segment(text)].length;
  }
  return [...text].length;
}

/**
 * Characters a post uses on a platform, counted the way the platform does.
 * @param {string} html A post's text
 * @param {string} network
 * @param {string} [tags] Mastodon tags, which are appended to every post
 * @returns {number}
 */
export function countCharacters(html, network, tags = '') {
  if (network === 'bluesky') {
    return graphemeCount(visibleText(html));
  }
  const text = postToNetworkText(html, network);
  // Punctuation right after a link ("(https://…)", "https://….") isn't part of it.
  let count = text.replace(URL_PATTERN, (url) => {
    const trailing = url.match(/[).,;:!?\]'"”’]+$/)?.[0] || '';
    return 'x'.repeat(LINK_LENGTH) + trailing;
  }).length;
  const formattedTags = network === 'mastodon' ? formatTags(tags) : '';
  if (formattedTags) {
    count += 2 + formattedTags.length; // "\n\n" + tags
  }
  return count;
}

/**
 * Whether every post in a thread fits its platform: within the character limit, no more than
 * MEDIA_LIMIT images, and not empty.
 * @param {Object} thread
 * @param {string} network
 */
export function threadProblems(thread, network) {
  const problems = [];
  thread.posts.forEach((post, i) => {
    if (
      countCharacters(post.text, network, thread.tags) >
      NETWORK_LIMITS[network].post
    ) {
      problems.push(`post ${i + 1} is over the limit`);
    }
    if (post.media.length > MEDIA_LIMIT) {
      problems.push(`post ${i + 1} has more than ${MEDIA_LIMIT} images`);
    }
    if (!visibleText(post.text).trim() && !post.media.length) {
      problems.push(`post ${i + 1} is empty`);
    }
  });
  if (!thread.posts.length) {
    problems.push('the thread is empty');
  }
  return problems;
}

// Fingerprints ---------------------------------------------------------------------------------

/**
 * The main post's paragraphs as plain text, for "show what changed".
 * @param {{blocks: Object[]}} post EditorJS data
 */
export function postParagraphs(post) {
  return (post.blocks || [])
    .filter((block) => ['paragraph', 'quote'].includes(block.type))
    .map((block) => visibleText(block.data.text || '').trim())
    .filter(Boolean);
}

/**
 * A short fingerprint of everything in the main post that a thread is built from. A thread whose
 * fingerprint no longer matches was built from an older version of the post.
 * @param {{blocks: Object[]}} post EditorJS data
 * @returns {string}
 */
export function fingerprintPost(post) {
  const relevant = (post.blocks || [])
    .filter((block) =>
      ['paragraph', 'quote', 'embed', 'image', 'socialPostDelimiter'].includes(
        block.type,
      ),
    )
    .map((block) => [
      block.type,
      block.data?.text ?? block.data?.source ?? block.data?.file?.url ?? '',
      block.data?.alt ?? '',
    ]);
  // djb2: stable and small; this only needs to notice changes, not resist tampering.
  let hash = 5381;
  for (const char of JSON.stringify(relevant)) {
    hash = ((hash * 33) ^ char.charCodeAt(0)) >>> 0;
  }
  return hash.toString(16);
}
