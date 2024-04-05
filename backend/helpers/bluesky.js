import Bsky from '@atproto/api';
import * as cheerio from 'cheerio';
import { NETWORK_LIMITS } from '../../frontend/js/helpers/editorHelpers.js';
const { BskyAgent, RichText, UnicodeString } = Bsky;

import auth from '../config/auth.config.js';

export const createRichText = (post, $, $links) => {
  const facets = [];
  const postText = $.text();
  const postBytes = new UnicodeString(postText);

  while ($links.length > 0) {
    const $link = $($links[0]);
    const facet = {
      features: [
        { uri: $link.attr('href'), $type: 'app.bsky.richtext.facet#link' },
      ],
      index: {},
    };

    // Extract indices, convert to UTF-8 indices
    const startInd = $link[0].startIndex;
    const endInd = startInd + $link.text().length;
    facet.index.byteStart = postBytes.utf16IndexToUtf8Index(startInd);
    facet.index.byteEnd = postBytes.utf16IndexToUtf8Index(endInd);
    facets.push(facet);

    // Remove link, recreate cheerio representation to move on with updated indices
    $link.replaceWith($link.text());
    $ = cheerio.load(
      $.html(),
      {
        xmlMode: true,
        withStartIndices: true,
        withEndIndices: true,
        decodeEntities: false,
      },
      false,
    );
    $links = $('a');
  }
  return {
    $type: 'app.bsky.feed.post',
    text: postBytes.toString(),
    facets,
    createdAt: new Date().toISOString(),
  };
};

export const makeSkeet = async (post, agent) => {
  const $ = cheerio.load(
    post.text,
    {
      xmlMode: true,
      withStartIndices: true,
      withEndIndices: true,
      decodeEntities: false,
    },
    false,
  );
  const $links = $('a');
  let needsCustomRichText = false;
  $links.each((_, elem) => {
    const $el = $(elem);
    if ($el.text() !== $(elem).attr('href')) {
      needsCustomRichText = true;
      return false;
    }
  });

  if (!needsCustomRichText) {
    // Replace any link with just the plain URL
    $links.each((_, elem) => {
      const $a = $(elem);
      $a.replaceWith($a.attr('href'));
    });
    // Strip remaining HTML since processText doesn't do this for Bsky
    const text = $.text();
    const rt = new RichText({ text });
    await rt.detectFacets(agent);
    return {
      $type: 'app.bsky.feed.post',
      text: rt.text,
      facets: rt.facets,
      createdAt: new Date().toISOString(),
    };
  } else {
    return createRichText(post, $, $links);
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
    const skeet = await makeSkeet(post, agent);
    if (post.images.length > 0) {
      skeet.embed = {
        $type: 'app.bsky.embed.images',
        images: post.images.map((image) => ({
          image: imagesMap[image.href].blob,
          alt: image.alt.substring(0, NETWORK_LIMITS.bluesky.alt),
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
