import { createRestAPIClient } from 'masto';
import auth from '../config/auth.config.js';

export const postToots = async (posts, imagesMap) => {
  const client = createRestAPIClient({
    url: 'https://hachyderm.io/',
    accessToken: auth.mastodonApiKey,
  });

  // Upload images
  const imagesToUpload = posts.reduce((acc, post) => {
    acc = acc.concat(post.images);
    return acc;
  }, []);
  const promises = [];
  for (let image of imagesToUpload) {
    const imageBuffer = imagesMap[image.href].buffer;
    const mimeType = imagesMap[image.href].mimeType;
    promises.push(
      Promise.all([
        image.href,
        client.v2.media.create({
          file: new Blob([imageBuffer], { type: mimeType }),
          description: image.alt,
        }),
      ]),
    );
  }
  const imageResults = await Promise.all(promises);
  for (let result of imageResults) {
    imagesMap[result[0]].mediaId = result[1].id;
  }

  const tootsToPost = posts.map((post) => {
    const toot = {
      status: post.text,
      visibility: 'public',
    };
    if (post.images.length > 0) {
      toot.mediaIds = post.images.map((image) => imagesMap[image.href].mediaId);
    }
    return toot;
  });

  // Post toots
  const results = [];
  for (let i = 0; i < tootsToPost.length; i++) {
    const toot = tootsToPost[i];
    if (i === 0) {
      const result = await client.v1.statuses.create(toot);
      results.push(result.id);
    } else {
      const result = await client.v1.statuses.create({
        ...toot,
        inReplyToId: results[i - 1].id,
      });
      results.push(result.id);
    }
  }
  return results[0];
};
