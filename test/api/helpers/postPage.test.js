import { DateTime } from 'luxon';
import { entryMeta } from '../../../api/helpers/entryMeta';
import { labelFeedEntry } from '../../../backend/helpers/feedEntries';
import { sortWebmentions } from '../../../backend/helpers/postPage';

const now = DateTime.fromISO('2026-11-07T12:00:00', {
  zone: 'America/New_York',
});

describe('post page', () => {
  it('sorts webmentions into replies, mentions, likes, reposts and bookmarks', () => {
    const wm = (type, fields = {}) => ({
      approved: true,
      source: `https://x/${type}`,
      body: { type, ...fields },
    });
    const sorted = sortWebmentions([
      wm('reply', { content: 'Nice', published: '2026-10-31' }),
      wm('mention', { title: 'Their post' }),
      wm('like'),
      wm('repost'),
      wm('bookmark', { summary: 'Saved with a note' }),
      wm('like', {}),
      {
        approved: false,
        source: 'https://x/spam',
        body: { type: 'reply', content: 'spam' },
      },
    ]);
    expect(
      Object.fromEntries(Object.entries(sorted).map(([k, v]) => [k, v.length])),
    ).toEqual({
      replies: 2, // The bookmark has words, so it reads as a response
      mentions: 1,
      likes: 2,
      reposts: 1,
      bookmarks: 0,
    });
  });

  it('shows the full date, permalink, sources of the post, tag counts and archives', () => {
    const meta = entryMeta(
      {
        slug: '202610301811',
        createdAt: new Date('2026-10-30T22:11:00Z'),
        post: { blocks: [{ type: 'paragraph' }] },
        tags: [
          { value: 'coinbase', text: 'coinbase', frequency: { total: 12 } },
        ],
        relatedPosts: [
          { model: 'ShortformEntry', ref: { title: 'A', href: 'https://a' } },
        ],
        pageMeta: {
          archive: { page: 'https://web.archive.org/p', archived: 3, total: 3 },
        },
        feedMeta: {
          threads: [
            {
              title: 'Coinbase FEC complaint',
              slug: 'c',
              position: 4,
              total: 4,
            },
          ],
          archived: {
            'https://www.mollywhite.net/micro/entry/202610301811':
              'https://web.archive.org/p',
          },
        },
      },
      { now, isPermalink: true },
    );
    expect(meta.date.text).toEqual('Friday, October 30, 2026 · 6:11 pm ET');
    const rows = Object.fromEntries(meta.rows.map((r) => [r.label, r.items]));
    expect(Object.keys(rows)).toEqual([
      'permalink',
      'from',
      'tags',
      'discuss', // "your site": the webmention form
      'archived',
    ]);
    // The permalink carries the post's u-url, since the date above it isn't a link here
    expect(rows.permalink).toEqual([
      {
        text: '/micro/entry/202610301811',
        href: '/micro/entry/202610301811',
        className: 'u-url',
      },
    ]);
    expect(rows.from.map((i) => i.text)).toEqual([
      'micro posts',
      'shortform reading',
    ]);
    expect(rows.tags).toEqual([
      { text: '#coinbase', href: '/feed/tag/coinbase', count: 12 },
    ]);
    expect(rows.archived).toEqual([
      { text: 'this page', href: 'https://web.archive.org/p' },
      { text: 'all 3 links' },
    ]);
  });
});

describe('entry labels', () => {
  it('uses a post’s text, decoding entities so templates escape it only once', () => {
    expect(
      labelFeedEntry({
        micro: {
          slug: 'x',
          post: {
            blocks: [
              {
                type: 'paragraph',
                data: {
                  text: 'The White House’s "AI &amp; Crypto <b>Czar</b>"&nbsp;again',
                },
              },
            ],
          },
        },
      }).label,
    ).toEqual('The White House’s "AI & Crypto Czar" again');
  });
});
