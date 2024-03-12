import { TwitterApi } from 'twitter-api-v2';
import { NETWORK_LIMITS } from '../../frontend/js/helpers/editorHelpers.js';
import auth from '../config/auth.config.js';

export const postTweets = async (posts, imagesMap) => {
  const userClient = new TwitterApi({
    appKey: auth.twitterApiKey,
    appSecret: auth.twitterApiKeySecret,
    accessToken: auth.twitterAccessToken,
    accessSecret: auth.twitterAccessTokenSecret,
  });
  const client = userClient.readWrite;

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
      client.v1.uploadMedia(imageBuffer, { mimeType }).then((mediaId) => {
        if (image.alt) {
          return Promise.all([
            image.href,
            mediaId,
            client.v1.createMediaMetadata(mediaId, {
              alt_text: {
                text: image.alt.substring(0, NETWORK_LIMITS.twitter.alt),
              },
            }),
          ]);
        } else {
          return Promise.resolve([image.href, mediaId]);
        }
      }),
    );
  }
  const results = await Promise.all(promises);
  for (let result of results) {
    imagesMap[result[0]].mediaId = result[1];
  }

  // Post tweets
  const tweetsToPost = posts.map((post) => {
    const tweet = {
      text: post.text,
    };
    if (post.images.length > 0) {
      tweet.media = {
        media_ids: post.images.map((image) => imagesMap[image.href].mediaId),
      };
    }
    return tweet;
  });

  const tweets = await client.v2.tweetThread(tweetsToPost);
  return tweets[0].data.id;
};
