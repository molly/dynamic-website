import axios from 'axios';
import * as cheerio from 'cheerio';
import {
  formatTags,
  postToNetworkText,
} from '../../api/helpers/socialThreads.js';

/**
 * Turn post HTML into a platform's text: mentions become that platform's @handles, line breaks
 * become newlines, emphasis is dropped, and links are written out (except on Bluesky).
 * @param {string} _text
 * @param {string} network
 * @param {Object} [entities] Mentioned entities by id, for current-format mentions
 */
export const processText = (_text, network, entities = {}) => {
  // Replace whitespace
  let text = _text.replace(/\n{2,}/g, '\n\n');
  // Replace unusual whitespace characters with regular spaces. Non-breaking spaces are intentionally
  // kept (they arrive from the editor as &nbsp; and are decoded later).
  text = text.replace(/[\u2000-\u200B\u202F\u205F]/g, ' ');

  const $ = cheerio.load(text, null, false);

  // Replace current-format mentions with the entity's handle on this network, or the words as
  // written if it has none there
  $('span[data-entity]').each((_, elem) => {
    const $mention = $(elem);
    const account = entities[$mention.attr('data-entity')]?.accounts?.find(
      (a) => a.network === network,
    );
    $mention.replaceWith(
      account
        ? `${account.handle.startsWith('@') ? '' : '@'}${account.handle}`
        : $mention.text(),
    );
  });

  // Replace legacy mentions
  const $mentions = $('.cdx-mention');
  for (let mention of $mentions) {
    const $mention = $(mention);
    const $networkMention = $mention.find(`.${network}`);
    let username = null;
    if ($networkMention.length) {
      username = $networkMention.data('username');
      $mention.replaceWith(`${username.startsWith('@') ? '' : '@'}${username}`);
    } else {
      username = $mention.find('.cdx-mention-plain').text();
      $mention.replaceWith(username);
    }
  }

  // Replace breaks
  $('br').each((_, elem) => $(elem).replaceWith('\n\n'));

  // Replace links
  if (network !== 'bluesky') {
    // Bluesky supports rich text with links, so retain them for that network
    $('a').each((_, elem) => {
      const $a = $(elem);
      const linkText = $a.text();
      const href = $a.attr('href');
      if (linkText === href) {
        $a.replaceWith(href);
      } else {
        $a.replaceWith(`${linkText} (${href})`);
      }
    });
  }

  // Replace emphasis
  $('i, b, em, strong').each((_, elem) => {
    const $tag = $(elem);
    $tag.replaceWith($tag.text());
  });

  if (network === 'bluesky') {
    return { text: $.html(), plainText: $.text() };
  }
  // Returning .text() instead of .html() should strip any remaining HTML tags
  return { text: $.text() };
};

/**
 * Turn a saved thread's posts into what the posters take: text in the platform's format (Mastodon
 * tags added to each post) and images as { href, alt }.
 * @param {{text: string, media: {url: string, alt?: string}[]}[]} posts
 * @param {string} network
 * @param {string} [tags] Mastodon tags as typed
 */
export const processThread = (posts, network, tags = '') => {
  const formattedTags = network === 'mastodon' ? formatTags(tags) : '';
  return posts.map((post) => {
    let text = postToNetworkText(post.text, network).trim();
    if (formattedTags) {
      text += `\n\n${formattedTags}`;
    }
    return {
      text,
      images: post.media.map((item) => ({
        href: item.url,
        alt: item.alt || '',
      })),
    };
  });
};

// Get all images from posts and store in an object so they can be reused
export const getImages = async (socialPosts) => {
  // First collect all image URLs
  const imageUrls = new Set();
  for (let network of Object.keys(socialPosts)) {
    if (socialPosts[network]) {
      for (let post of socialPosts[network]) {
        for (let image of post.images) {
          imageUrls.add(image.href);
        }
      }
    }
  }

  // Fetch images
  const promises = [];

  // Set doesn't have .map() ¯\_(ツ)_/¯
  imageUrls.forEach((url) =>
    promises.push(
      axios.get(url, {
        decompress: false,
        responseType: 'arraybuffer',
      }),
    ),
  );

  const images = await Promise.all(promises).then((responses) => {
    const images = {};
    for (let response of responses) {
      images[response.config.url] = {
        buffer: Buffer.from(response.data),
        mimeType: response.headers['content-type'],
      };
    }
    return images;
  });
  return images;
};
