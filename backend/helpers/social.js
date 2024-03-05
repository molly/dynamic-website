import axios from 'axios';

export const processText = (text) => {
  const processed = text
    .replace(/<br ?\/? ?>/g, '\n')
    .replace(/<(?:i|b|em|strong)>(.*?)<\/(?:i|b|em|strong)>/g, (_, p1) =>
      p1.toUpperCase(),
    )
    .replace(/<a[^>]+>(.*?)<\/a>/, '$1')
    .replace(/<[^>]+>(.*?)<\/[^>]+>/g, '$1');
  return processed;
};

const EMPTY_POST = { text: '', images: [] };

// Format post to be posted to social media
export const processSocialPost = (blocks, tags = null) => {
  const posts = [];
  let currentPost = JSON.parse(JSON.stringify(EMPTY_POST));
  for (let block of blocks) {
    switch (block.type) {
      case 'paragraph':
        if (currentPost.text.length > 0) {
          currentPost.text += '\n\n';
        }
        currentPost.text += processText(block.data.text);
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
