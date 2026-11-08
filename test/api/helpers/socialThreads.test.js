import {
  countCharacters,
  fingerprintPost,
  formatTags,
  postToNetworkText,
  threadProblems,
  visibleText,
} from '../../../api/helpers/socialThreads';
import { processThread } from '../../../backend/helpers/social';
import {
  buildThread,
  leftOutOfThreads,
} from '../../../frontend/js/threads/buildThread';

const LINKED = 'I <a href="https://example.com/a">reported</a> it &amp; more';

describe('postToNetworkText', () => {
  it('writes links out for platforms without rich text', () => {
    expect(postToNetworkText(LINKED, 'twitter')).toEqual(
      'I reported (https://example.com/a) it & more',
    );
  });

  it('keeps a link whose text is the URL as just the URL', () => {
    expect(
      postToNetworkText(
        '<a href="https://example.com">https://example.com</a>',
        'mastodon',
      ),
    ).toEqual('https://example.com');
  });

  it('keeps links for Bluesky, with line breaks as newlines', () => {
    expect(postToNetworkText(`one<br>two ${LINKED}`, 'bluesky')).toEqual(
      `one\ntwo ${LINKED}`,
    );
  });
});

describe('countCharacters', () => {
  it('counts every URL as 23 on Twitter and Mastodon', () => {
    // "I reported (" + 23 + ") it & more"
    expect(countCharacters(LINKED, 'twitter')).toEqual(12 + 23 + 11);
  });

  it('counts only visible text on Bluesky', () => {
    expect(countCharacters(LINKED, 'bluesky')).toEqual(
      'I reported it & more'.length,
    );
  });

  it('adds Mastodon tags to every post', () => {
    expect(countCharacters('hi', 'mastodon', 'crypto, law')).toEqual(
      2 + 2 + '#crypto #law'.length,
    );
  });
});

describe('formatTags', () => {
  it('adds # and normalizes separators', () => {
    expect(formatTags('crypto, #law  courts')).toEqual('#crypto #law #courts');
    expect(formatTags('')).toEqual('');
  });
});

describe('threadProblems', () => {
  it('flags long, image-heavy and empty posts', () => {
    const thread = {
      posts: [
        { text: 'x'.repeat(281), media: [] },
        { text: 'ok', media: Array(5).fill({ url: 'u' }) },
        { text: '<br>', media: [] },
      ],
    };
    expect(threadProblems(thread, 'twitter')).toEqual([
      'post 1 is over the limit',
      'post 2 has more than 4 images',
      'post 3 is empty',
    ]);
  });
});

describe('buildThread', () => {
  const paragraph = (text) => ({ type: 'paragraph', data: { text } });

  it('fills posts up to the limit, then starts a new one', () => {
    const long = 'a'.repeat(200);
    const thread = buildThread(
      { blocks: [paragraph(long), paragraph(long), paragraph('short')] },
      'twitter',
    );
    expect(thread.posts.map((p) => visibleText(p.text))).toEqual([
      long,
      `${long}\n\nshort`,
    ]);
    expect(thread.edited).toBe(false);
  });

  it('starts a new post at a manual break and keeps images with their post', () => {
    const thread = buildThread(
      {
        blocks: [
          paragraph('one'),
          {
            type: 'image',
            data: { file: { url: 'https://i/1.png' }, alt: 'chart' },
          },
          { type: 'socialPostDelimiter', data: {} },
          paragraph('two'),
        ],
      },
      'bluesky',
    );
    expect(thread.posts).toEqual([
      { text: 'one', media: [{ url: 'https://i/1.png', alt: 'chart' }] },
      { text: 'two', media: [] },
    ]);
  });

  it('escapes text for platforms without rich text', () => {
    const thread = buildThread({ blocks: [paragraph('a &lt; b')] }, 'mastodon');
    expect(thread.posts[0].text).toEqual('a &lt; b');
    expect(thread.tags).toEqual('');
  });

  it('records the post it was built from', () => {
    const post = { blocks: [paragraph('one')] };
    const thread = buildThread(post, 'twitter');
    expect(thread.basedOn).toEqual({
      hash: fingerprintPost(post),
      paragraphs: ['one'],
    });
    expect(fingerprintPost({ blocks: [paragraph('one!')] })).not.toEqual(
      thread.basedOn.hash,
    );
  });

  it('includes headings, lists and code, one list item per line', () => {
    const thread = buildThread(
      {
        blocks: [
          { type: 'header', data: { text: 'What happened', level: 2 } },
          {
            type: 'list',
            data: { style: 'unordered', items: ['one', '<b>two</b>'] },
          },
          { type: 'list', data: { style: 'ordered', items: ['first'] } },
          { type: 'code', data: { code: 'npm run related' } },
        ],
      },
      'mastodon',
    );
    expect(visibleText(thread.posts[0].text)).toEqual(
      'What happened\n\n• one\n• two\n\n1. first\n\nnpm run related',
    );
  });

  it('follows images with their captions, and quotes with who said them', () => {
    const thread = buildThread(
      {
        blocks: [
          {
            type: 'image',
            data: { file: { url: 'https://i/1.png' }, caption: 'The chart' },
          },
          {
            type: 'gallery',
            data: {
              caption: 'Both PACs',
              files: [
                { url: 'https://i/2.png', caption: 'Fairshake' },
                { url: 'https://i/3.png', caption: 'Leading the Future' },
              ],
            },
          },
          { type: 'quote', data: { text: 'Big words', caption: 'A senator' } },
        ],
      },
      'twitter',
    );
    expect(thread.posts[0].media.map((m) => m.url)).toEqual([
      'https://i/1.png',
      'https://i/2.png',
      'https://i/3.png',
    ]);
    expect(visibleText(thread.posts[0].text)).toEqual(
      'The chart\n\n1/2 · Fairshake\n2/2 · Leading the Future\n\nBoth PACs\n\n"Big words" — A senator',
    );
  });

  it('leaves out raw HTML, tables and video and audio, and says so', () => {
    const post = {
      blocks: [
        paragraph('words'),
        { type: 'raw', data: { html: '<div>x</div>' } },
        { type: 'table', data: { content: [['a']] } },
        { type: 'media', data: { kind: 'video', url: 'https://v/1.mp4' } },
        { type: 'media', data: { kind: 'video', url: 'https://v/2.mp4' } },
      ],
    };
    expect(
      buildThread(post, 'bluesky').posts.map((p) => visibleText(p.text)),
    ).toEqual(['words']);
    expect(leftOutOfThreads(post)).toEqual([
      'an HTML block',
      'a table',
      '2 videos',
    ]);
    expect(leftOutOfThreads({ blocks: [paragraph('words')] })).toEqual([]);
  });
});

describe('processThread', () => {
  it('formats posts for the posters, adding Mastodon tags', () => {
    expect(
      processThread(
        [{ text: LINKED, media: [{ url: 'https://i/1.png', alt: 'chart' }] }],
        'mastodon',
        'crypto',
      ),
    ).toEqual([
      {
        text: 'I reported (https://example.com/a) it & more\n\n#crypto',
        images: [{ href: 'https://i/1.png', alt: 'chart' }],
      },
    ]);
  });
});
