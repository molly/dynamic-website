import {
  countCharacters,
  fingerprintPost,
  formatTags,
  postToNetworkText,
  threadProblems,
  visibleText,
} from '../../../api/helpers/socialThreads';
import { processThread } from '../../../backend/helpers/social';
import { buildThread } from '../../../frontend/js/threads/buildThread';

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
