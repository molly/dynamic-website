import Bsky from '@atproto/api';
import * as cheerio from 'cheerio';
import { NETWORK_LIMITS } from '../../frontend/js/helpers/editorHelpers.js';
const { BskyAgent, RichText, UnicodeString } = Bsky;

import imageSize from 'image-size';
import auth from '../config/auth.config.js';

/**
 * Flatten a post's HTML (as produced by processText for Bluesky) into plain text, along with the
 * positions of its links within that text. HTML entities (&nbsp;, &amp;, etc.) are decoded, and
 * link positions are measured in the decoded text, not the HTML source.
 * @param {string} html
 * @returns {{ text: string, links: { href: string, start: number, end: number }[] }} Link
 *   positions are UTF-16 indices into text.
 */
export const extractTextAndLinks = (html) => {
  const $ = cheerio.load(html, null, false);
  let text = '';
  const links = [];
  const walk = (nodes) => {
    for (const node of nodes) {
      if (node.type === 'text') {
        text += node.data;
      } else if (node.children) {
        const start = text.length;
        walk(node.children);
        if (node.name === 'a') {
          links.push({ href: node.attribs.href, start, end: text.length });
        }
      }
    }
  };
  walk($.root()[0].children);
  return { text, links };
};

export const createRichText = (text, links) => {
  const postBytes = new UnicodeString(text);
  const facets = links.map(({ href, start, end }) => ({
    features: [{ uri: href, $type: 'app.bsky.richtext.facet#link' }],
    // Bluesky facet indices are UTF-8 byte offsets
    index: {
      byteStart: postBytes.utf16IndexToUtf8Index(start),
      byteEnd: postBytes.utf16IndexToUtf8Index(end),
    },
  }));
  return {
    $type: 'app.bsky.feed.post',
    text,
    facets,
    createdAt: new Date().toISOString(),
  };
};

export const makeSkeet = async (post, agent) => {
  const { text, links } = extractTextAndLinks(post.text);
  const needsCustomRichText = links.some(
    ({ href, start, end }) => text.substring(start, end) !== href,
  );

  if (!needsCustomRichText) {
    // Any links are just plain URLs in the text, which detectFacets will pick up
    const rt = new RichText({ text });
    await rt.detectFacets(agent);
    return {
      $type: 'app.bsky.feed.post',
      text: rt.text,
      facets: rt.facets,
      createdAt: new Date().toISOString(),
    };
  } else {
    return createRichText(text, links);
  }
};

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
    const size = imageSize(imageBuffer);

    const mimeType = imagesMap[image.href].mimeType;
    promises.push(
      Promise.all([
        image.href,
        agent.uploadBlob(imageBuffer, { encoding: mimeType }),
        { width: size.width, height: size.height },
      ]),
    );
  }
  const imageResults = await Promise.all(promises);
  for (let result of imageResults) {
    imagesMap[result[0]].blob = result[1].data.blob;
    imagesMap[result[0]].aspectRatio = result[2];
  }

  const skeetsToPost = [];
  for (let post of posts) {
    const skeet = await makeSkeet(post, agent);
    if (post.images.length > 0) {
      skeet.embed = {
        $type: 'app.bsky.embed.images',
        images: post.images.map((image) => ({
          image: imagesMap[image.href].blob,
          alt: image.alt.substring(0, NETWORK_LIMITS.bluesky.alt),
          aspectRatio: imagesMap[image.href].aspectRatio,
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
