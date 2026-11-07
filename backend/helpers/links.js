import * as cheerio from 'cheerio';

// Finding the links in a post, for webmentions and archiving.

// Extract all URLs from a block of text
export const extractUrlsFromText = (text) => {
  if (!text) {
    return [];
  }
  if (text.includes('cdx-mention')) {
    // Use heavier processing if mentions are used
    const links = [];
    const $ = cheerio.load(text, null, false);
    for (let link of $('a')) {
      const $link = $(link);
      if (!$link.data('username') && $link.attr('href').startsWith('http')) {
        links.push($link.attr('href'));
      }
    }
    return links;
  } else {
    // Otherwise a simple regex should suffice
    const matches = text.matchAll(/<a.*?href=['"](http.*?)["']/g);
    return Array.from(matches).map((match) => match[1]);
  }
};

/**
 * URLs linked from a post's blocks. Links to people's profiles inside old-format mentions are
 * skipped.
 * @param {Object[]} blocks EditorJS blocks
 * @param {{embeds?: boolean}} [options] embeds: also include embedded URLs (tweets, videos)
 * @returns {string[]}
 */
export const extractUrlsFromBlocks = (blocks, { embeds = false } = {}) => {
  const urls = [];
  for (let block of blocks) {
    if (embeds && block.type === 'embed' && block.data.source) {
      urls.push(block.data.source);
    }
    if (block.type === 'article' && block.data.snapshot?.href) {
      urls.push(block.data.snapshot.href);
    } else if (block.type === 'roundup') {
      for (const item of block.data.items || []) {
        if (item.snapshot?.href) {
          urls.push(item.snapshot.href);
        }
      }
    } else if (block.type === 'table') {
      for (const row of block.data.content || []) {
        for (const cell of row) {
          urls.push(...extractUrlsFromText(cell));
        }
      }
    }
    if (block.type === 'paragraph') {
      const text = block.data.text;
      urls.push(...extractUrlsFromText(text));
    } else if (block.type === 'list') {
      for (let item of block.data.items) {
        urls.push(...extractUrlsFromText(item));
      }
    } else if (block.type === 'image') {
      urls.push(...extractUrlsFromText(block.data.caption));
    } else if (block.type === 'gallery') {
      urls.push(...extractUrlsFromText(block.data.caption));
      for (const file of block.data.files || []) {
        urls.push(...extractUrlsFromText(file.caption));
      }
    } else if (block.type === 'raw') {
      urls.push(...extractUrlsFromText(block.data.html));
    }
  }
  return urls;
};

/**
 * The posts within an entry: the main post, then each update's body.
 * @param {{post?: Object, updates?: {body?: Object}[]}} entry
 * @returns {{blocks: Object[]}[]}
 */
export const entryPosts = (entry) =>
  [entry?.post, ...(entry?.updates || []).map((u) => u.body)].filter(
    (post) => post?.blocks,
  );

/**
 * Every block in an entry, the main post's and its updates', for finding links.
 * @param {{post?: Object, updates?: {body?: Object}[]}} entry
 * @returns {Object[]}
 */
export const entryBlocks = (entry) =>
  entryPosts(entry).flatMap((p) => p.blocks);

/**
 * URLs an entry links to outside its text: sources, data and the post it replies to.
 * @param {Object} entry
 * @returns {string[]}
 */
export const entryMetadataUrls = (entry) =>
  [
    ...(entry?.sources || []).map((s) => s.url),
    entry?.data?.url,
    entry?.inReplyTo?.url,
  ].filter((url) => /^https?:\/\//.test(url || ''));
