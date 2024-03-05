import Bsky from '@atproto/api';
const { BskyAgent, RichText } = Bsky;

import auth from '../config/auth.config.js';

export const postSkeets = async (posts, imagesMap) => {
  const agent = new BskyAgent({
    service: 'https://bsky.social',
  });
  await agent.login({
    identifier: 'molly.wiki',
    password: auth.blueskyPassword,
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
        agent.uploadBlob(imageBuffer, { encoding: mimeType }),
      ]),
    );
  }
  const imageResults = await Promise.all(promises);
  for (let result of imageResults) {
    imagesMap[result[0]].blob = result[1].data.blob;
  }

  const skeetsToPost = [];
  for (let post of posts) {
    const rt = new RichText({ text: post.text });
    await rt.detectFacets(agent);
    const skeet = {
      $type: 'app.bsky.feed.post',
      text: rt.text,
      facets: rt.facets,
      createdAt: new Date().toISOString(),
    };
    if (post.images.length > 0) {
      skeet.embed = {
        $type: 'app.bsky.embed.images',
        images: post.images.map((image) => ({
          image: imagesMap[image.href].blob,
          alt: image.alt,
        })),
      };
    }
    skeetsToPost.push(skeet);
  }

  // Post skeets
  const results = [];
  for (let i = 0; i < skeetsToPost.length; i++) {
    const skeet = skeetsToPost[i];
    if (i === 0) {
      const result = await agent.post(skeet);
      results.push(result);
    } else {
      const result = await agent.post({
        ...skeet,
        reply: {
          parent: results[i - 1],
          root: results[0],
        },
      });
      results.push(result);
    }
  }
  return results[0].uri.split('/').pop();
};
