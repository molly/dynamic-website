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
