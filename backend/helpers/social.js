import axios from 'axios';
import * as cheerio from 'cheerio';

export const processText = (text, network) => {
  // Replace whitespace
  text.replace(/\n{2,}/g, '\n\n');
  text.replace(/[\u00A0\u2000-\u200B\u202F\u205F]/g, ' ');

  const $ = cheerio.load(text, null, false);

  // Replace mentions
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

const EMPTY_POST = { text: '', images: [] };

// Format post to be posted to social media
export const processSocialPost = (blocks, network, tags = null) => {
  const posts = [];
  let currentPost = JSON.parse(JSON.stringify(EMPTY_POST));
  for (let block of blocks) {
    switch (block.type) {
      case 'paragraph':
        if (currentPost.text.length > 0) {
          currentPost.text += '\n\n';
        }
        currentPost.text += processText(block.data.text, network).text;
        break;
      case 'socialPostDelimiter':
        if (tags && tags.length > 0) {
          currentPost.text += '\n\n' + tags;
        }
        posts.push(currentPost);
        currentPost = JSON.parse(JSON.stringify(EMPTY_POST));
        break;
      case 'image':
        currentPost.images.push({
          href: block.data.file.url,
          alt: block.data.alt,
        });
        break;
    }
  }
  return posts;
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
