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
    if (block.type === 'paragraph') {
      const text = block.data.text;
      urls.push(...extractUrlsFromText(text));
    } else if (block.type === 'list') {
      for (let item of block.data.items) {
        urls.push(...extractUrlsFromText(item));
      }
    } else if (block.type === 'image') {
      urls.push(...extractUrlsFromText(block.data.caption));
    } else if (block.type === 'raw') {
      urls.push(...extractUrlsFromText(block.data.html));
    }
  }
  return urls;
};
