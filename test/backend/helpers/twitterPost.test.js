import { twitterProfileUrl } from '../../../api/helpers/postUrl';
import { saveTwitterPosts } from '../../../backend/helpers/socialFetch';
import {
  tweetTextToHtml,
  tweetThread,
} from '../../../backend/helpers/twitterPost';

// Shaped like x.com's TweetDetail responses, trimmed to the fields that are read.
const user = (id, screenName, name, { newLayout = false } = {}) => ({
  __typename: 'User',
  rest_id: id,
  ...(newLayout
    ? { core: { screen_name: screenName, name }, legacy: {} }
    : { legacy: { screen_name: screenName, name } }),
});

const tweet = (id, author, legacy, extra = {}) => ({
  __typename: 'Tweet',
  rest_id: id,
  core: { user_results: { result: author } },
  legacy: { created_at: 'Wed Oct 29 14:05:00 +0000 2025', ...legacy },
  ...extra,
});

const NGMI = user('111', '0xngmi', '0xngmi');
const CZ = user('222', 'cz_binance', 'CZ BNB', { newLayout: true });

const ROOT = tweet('1', NGMI, {
  full_text: 'Binance will cover it &amp; more',
  display_text_range: [0, 28],
  entities: {},
});
const REPLY = tweet('2', CZ, {
  full_text:
    '@0xngmi Loss might be higher, but will cover. cc @ElonMusk https://t.co/abc https://t.co/media1',
  display_text_range: [8, 75],
  in_reply_to_status_id_str: '1',
  entities: {
    user_mentions: [
      { id_str: '111', screen_name: '0xngmi', indices: [0, 7] },
      { id_str: '44196397', screen_name: 'elonmusk', indices: [49, 58] },
    ],
    urls: [
      {
        url: 'https://t.co/abc',
        expanded_url: 'https://example.com/a/long/path',
        display_url: 'example.com/a/long/…',
      },
    ],
    media: [{ url: 'https://t.co/media1' }],
  },
  extended_entities: {
    media: [
      {
        type: 'photo',
        url: 'https://t.co/media1',
        media_url_https: 'https://pbs.twimg.com/media/Abc123.jpg',
        ext_alt_text: 'a chart',
      },
    ],
  },
});

const RESPONSE = {
  data: {
    threaded_conversation_with_injections_v2: {
      instructions: [
        {
          type: 'TimelineAddEntries',
          entries: [
            {
              entryId: 'tweet-1',
              content: { itemContent: { tweet_results: { result: ROOT } } },
            },
            {
              entryId: 'tweet-2',
              content: {
                itemContent: {
                  tweet_results: {
                    // Limited-visibility posts come wrapped
                    result: {
                      __typename: 'TweetWithVisibilityResults',
                      tweet: REPLY,
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    },
  },
};

describe('twitterProfileUrl', () => {
  it('links by permanent user ID when there is one, else by handle', () => {
    expect(twitterProfileUrl({ accountId: '111', handle: 'old' })).toEqual(
      'https://twitter.com/i/user/111',
    );
    expect(twitterProfileUrl({ handle: 'someone' })).toEqual(
      'https://twitter.com/someone',
    );
    expect(twitterProfileUrl({})).toEqual('');
  });
});

describe('tweetThread', () => {
  it('reads the pasted post and the posts it replies to, oldest first', () => {
    const posts = tweetThread(RESPONSE, '2');
    expect(posts).toHaveLength(2);
    expect(posts[0]).toMatchObject({
      network: 'twitter',
      authorName: '0xngmi',
      handle: '0xngmi',
      accountId: '111',
      profileUrl: 'https://twitter.com/i/user/111',
      originalUrl: 'https://twitter.com/0xngmi/status/1',
      postedAt: '2025-10-29T14:05:00.000Z',
      textHtml: 'Binance will cover it &amp; more',
    });
    expect(posts[1]).toMatchObject({
      authorName: 'CZ BNB',
      handle: 'cz_binance',
      accountId: '222',
      media: [
        {
          type: 'image',
          remoteUrl: 'https://pbs.twimg.com/media/Abc123.jpg?name=orig',
          filename: 'Abc123.jpg',
          alt: 'a chart',
        },
      ],
    });
  });

  it('links mentions by user ID as written, hides the reply prefix and media link, and expands links', () => {
    const [, reply] = tweetThread(RESPONSE, '2');
    expect(reply.textHtml).toEqual(
      'Loss might be higher, but will cover. cc <a href="https://twitter.com/i/user/44196397">@ElonMusk</a> <a href="https://example.com/a/long/path">example.com/a/long/…</a>',
    );
  });

  it('starts at the pasted post when it is not a reply', () => {
    expect(tweetThread(RESPONSE, '1')).toHaveLength(1);
  });

  it('says so when the post is not in the response', () => {
    expect(() => tweetThread(RESPONSE, '999')).toThrow(/didn’t return/);
    // A deleted post comes back as a tombstone, with no text
    expect(() =>
      tweetThread(
        { result: { __typename: 'TweetTombstone', rest_id: '3' } },
        '3',
      ),
    ).toThrow(/didn’t return/);
  });

  it('reads a quoted post, a video, a link card and a long post', () => {
    const quotedTweet = tweet('10', NGMI, {
      full_text: 'The quoted post',
      entities: {},
    });
    const longText = `${'word '.repeat(70)}@0xngmi`;
    const main = tweet(
      '11',
      CZ,
      {
        full_text: 'cut short… https://t.co/q',
        quoted_status_id_str: '10',
        entities: {
          urls: [
            {
              url: 'https://t.co/q',
              expanded_url: 'https://x.com/0xngmi/status/10',
              display_url: 'x.com/0xngmi/status/10',
            },
            {
              url: 'https://t.co/card',
              expanded_url: 'https://news.example.com/story',
            },
          ],
        },
        extended_entities: {
          media: [
            {
              type: 'video',
              media_url_https:
                'https://pbs.twimg.com/ext_tw_video_thumb/1/pu/img/p.jpg',
              video_info: {
                duration_millis: 4200,
                variants: [
                  {
                    content_type: 'application/x-mpegURL',
                    url: 'https://video.twimg.com/a.m3u8',
                  },
                  {
                    content_type: 'video/mp4',
                    bitrate: 832000,
                    url: 'https://video.twimg.com/low.mp4?tag=1',
                  },
                  {
                    content_type: 'video/mp4',
                    bitrate: 2176000,
                    url: 'https://video.twimg.com/high.mp4?tag=1',
                  },
                ],
              },
            },
          ],
        },
      },
      {
        note_tweet: {
          note_tweet_results: {
            result: {
              text: `${longText} https://t.co/q`,
              entity_set: {
                user_mentions: [{ id_str: '111', screen_name: '0xngmi' }],
                urls: [
                  {
                    url: 'https://t.co/q',
                    expanded_url: 'https://x.com/0xngmi/status/10',
                  },
                ],
              },
            },
          },
        },
        quoted_status_result: { result: quotedTweet },
        card: {
          legacy: {
            binding_values: [
              { key: 'card_url', value: { string_value: 'https://t.co/card' } },
              { key: 'title', value: { string_value: 'A story' } },
            ],
          },
        },
      },
    );
    const [post] = tweetThread({ main }, '11');
    // The full text of the long post, with the quoted post's link dropped as x.com does
    expect(post.textHtml).toEqual(
      `${'word '.repeat(70)}<a href="https://twitter.com/i/user/111">@0xngmi</a>`,
    );
    expect(post.media).toEqual([
      {
        type: 'video',
        remoteUrl: 'https://video.twimg.com/high.mp4?tag=1',
        filename: 'high.mp4',
        remotePoster: 'https://pbs.twimg.com/ext_tw_video_thumb/1/pu/img/p.jpg',
        duration: 4.2,
        alt: '',
      },
    ]);
    expect(post.linkCard).toEqual({
      url: 'https://news.example.com/story',
      domain: 'news.example.com',
      title: 'A story',
    });
    expect(post.quoted).toMatchObject({
      handle: '0xngmi',
      textHtml: 'The quoted post',
      quoted: null,
    });
  });
});

describe('tweetTextToHtml', () => {
  it('escapes text and keeps line breaks', () => {
    expect(
      tweetTextToHtml(
        tweet('5', NGMI, { full_text: 'a &lt;b&gt;\n\nc', entities: {} }),
      ),
    ).toEqual('a &lt;b&gt;<br><br>c');
  });

  it("doesn't link a longer handle that starts with a mentioned one", () => {
    expect(
      tweetTextToHtml(
        tweet('6', NGMI, {
          full_text: '@ab and @abc',
          entities: { user_mentions: [{ id_str: '1', screen_name: 'ab' }] },
        }),
      ),
    ).toEqual('<a href="https://twitter.com/i/user/1">@ab</a> and @abc');
  });
});

describe('saveTwitterPosts', () => {
  const post = {
    network: 'twitter',
    authorName: 'CZ BNB',
    handle: '@cz_binance',
    accountId: '222',
    profileUrl: 'https://evil.example/',
    originalUrl: 'https://twitter.com/cz_binance/status/2',
    postedAt: '2025-10-29T14:05:00.000Z',
    textHtml: 'Hi <script>alert(1)</script><b>there</b>',
    media: [
      {
        type: 'image',
        remoteUrl: 'https://pbs.twimg.com/media/A.jpg?name=orig',
        filename: 'A.jpg',
        alt: 'a',
        src: 'https://evil.example/a.jpg',
        saved: true,
      },
      { type: 'image', remoteUrl: 'http://169.254.169.254/latest', alt: '' },
      {
        type: 'video',
        remoteUrl: 'https://video.twimg.com.evil.example/v.mp4',
        remotePoster: 'https://pbs.twimg.com/p.jpg',
        duration: 3,
      },
    ],
    quoted: { originalUrl: 'https://x.com/a/status/1', extra: 'dropped' },
  };

  it('keeps only known fields, and only downloads media from x.com’s media servers', async () => {
    const [saved] = await saveTwitterPosts([post], { copyMedia: false });
    expect(saved).toMatchObject({
      handle: 'cz_binance',
      profileUrl: 'https://twitter.com/i/user/222',
      textHtml: 'Hi there',
    });
    expect(saved.media.map((m) => m.remoteUrl)).toEqual([
      'https://pbs.twimg.com/media/A.jpg?name=orig',
      null,
      null,
    ]);
    // Nothing the request says about saved copies is believed
    expect(saved.media[0]).toMatchObject({ src: null, saved: false });
    expect(saved.quoted).not.toHaveProperty('extra');
  });

  it('refuses anything that isn’t a Twitter post', async () => {
    await expect(
      saveTwitterPosts(
        [{ ...post, originalUrl: 'https://bsky.app/profile/a/post/b' }],
        {
          copyMedia: false,
        },
      ),
    ).rejects.toThrow('Not a Twitter post');
    await expect(saveTwitterPosts([], { copyMedia: false })).rejects.toThrow();
  });
});
