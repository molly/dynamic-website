import { cleanHtml } from '../../../api/helpers/html';
import { mapPostText } from '../../../api/helpers/mentions';
import {
  renderComparison,
  renderDocument,
  renderSocialPost,
} from '../../../api/helpers/sourceBlocks';
import { suggestSources } from '../../../api/helpers/sources';
import { extractUrlsFromBlocks } from '../../../backend/helpers/links';
import {
  blueskyTextToHtml,
  blueskyToPost,
  mastodonContentToHtml,
  mastodonToPost,
} from '../../../backend/helpers/socialFetch';
import { buildThread } from '../../../frontend/js/threads/buildThread';

const FILING = {
  docType: 'filing',
  title: 'Complaint · O’Leary v. Armstrong',
  paragraph: '27',
  excerptHtml:
    'Armstrong wrote: <mark>“Doesn’t everybody think it’s weird”</mark>',
  pdfUrl: 'https://example.com/complaint.pdf',
  pdfPage: '12',
  docketUrl: 'https://www.courtlistener.com/docket/1/x/',
};

const POST = {
  network: 'bluesky',
  authorName: 'CZ BNB',
  handle: 'cz.bsky.social',
  profileUrl: 'https://bsky.app/profile/cz.bsky.social',
  originalUrl: 'https://bsky.app/profile/cz.bsky.social/post/abc',
  postedAt: '2025-10-29T14:00:00Z',
  textHtml: 'Loss might be a bit higher<br>but will cover.',
  media: [
    {
      type: 'image',
      src: 'https://storage.mollywhite.net/a.jpg',
      alt: 'A chart',
      saved: true,
    },
    { type: 'image', src: null, alt: 'Lost', saved: false },
  ],
  linkCard: {
    url: 'https://example.com/story',
    domain: 'example.com',
    title: 'Story',
  },
  quoted: null,
};

describe('cleanHtml', () => {
  it('keeps only allowed tags and safe links', () => {
    expect(
      cleanHtml(
        '<p>Hi <a href="javascript:alert(1)">x</a> <a href="https://a.b" onclick="y">ok</a><script>bad()</script><img src=x onerror=z></p>',
      ),
    ).toEqual('Hi x <a href="https://a.b">ok</a>');
  });
});

describe('fetching social posts', () => {
  it('turns Bluesky facets into links, counting UTF-8 bytes', () => {
    const text = '🚨 read https://ex.com now @a.bsky.social #crypto';
    const bytes = (s) => new TextEncoder().encode(s).length;
    const at = (s) => bytes(text.slice(0, text.indexOf(s)));
    const facet = (s, feature) => ({
      index: { byteStart: at(s), byteEnd: at(s) + bytes(s) },
      features: [feature],
    });
    expect(
      blueskyTextToHtml(text, [
        facet('https://ex.com', {
          $type: 'app.bsky.richtext.facet#link',
          uri: 'https://ex.com',
        }),
        facet('@a.bsky.social', {
          $type: 'app.bsky.richtext.facet#mention',
          did: 'did:plc:a',
        }),
        facet('#crypto', {
          $type: 'app.bsky.richtext.facet#tag',
          tag: 'crypto',
        }),
      ]),
    ).toEqual(
      '🚨 read <a href="https://ex.com">https://ex.com</a> now <a href="https://bsky.app/profile/did:plc:a">@a.bsky.social</a> <a href="https://bsky.app/hashtag/crypto">#crypto</a>',
    );
  });

  it('shows Mastodon links as Mastodon does, with paragraphs as blank lines', () => {
    expect(
      mastodonContentToHtml(
        '<p>One &amp; two</p><p>See <a href="https://example.com/a/very/long/path" rel="nofollow"><span class="invisible">https://</span><span class="ellipsis">example.com/a/very</span><span class="invisible">/long/path</span></a></p>',
      ),
    ).toEqual(
      'One &amp; two<br><br>See <a href="https://example.com/a/very/long/path">example.com/a/very…</a>',
    );
  });

  it('reads a Bluesky post with a quoted post that has images', () => {
    const author = { did: 'did:plc:me', handle: 'me.test', displayName: 'Me' };
    const post = blueskyToPost({
      uri: 'at://did:plc:me/app.bsky.feed.post/111',
      author,
      record: { text: 'Look', createdAt: '2026-01-01T00:00:00Z' },
      replyCount: 1,
      likeCount: 4,
      embed: {
        $type: 'app.bsky.embed.record#view',
        record: {
          $type: 'app.bsky.embed.record#viewRecord',
          uri: 'at://did:plc:them/app.bsky.feed.post/222',
          author: { did: 'did:plc:them', handle: 'them.test' },
          value: { text: 'Quoted', createdAt: '2025-12-31T00:00:00Z' },
          embeds: [
            {
              $type: 'app.bsky.embed.images#view',
              images: [
                {
                  fullsize: 'https://cdn.bsky.app/img/x/plain/did/cid1@jpeg',
                  alt: 'pic',
                },
              ],
            },
          ],
        },
      },
    });
    expect(post).not.toHaveProperty('metrics');
    expect(post).toMatchObject({
      authorName: 'Me',
      originalUrl: 'https://bsky.app/profile/me.test/post/111',
      quoted: {
        authorName: 'them.test',
        originalUrl: 'https://bsky.app/profile/them.test/post/222',
        media: [{ type: 'image', alt: 'pic', filename: 'cid1.jpg' }],
      },
    });
  });

  it('reads a Mastodon status, with a local account’s full handle', () => {
    const post = mastodonToPost(
      {
        url: 'https://hachyderm.io/@m/1',
        created_at: '2026-01-01T00:00:00Z',
        content: '<p>Hi</p>',
        account: {
          acct: 'm',
          display_name: '',
          username: 'm',
          url: 'https://hachyderm.io/@m',
        },
        replies_count: 1,
        favourites_count: 3,
        media_attachments: [
          {
            type: 'gifv',
            url: 'https://x/v.mp4',
            preview_url: 'https://x/p.jpg',
            description: 'clip',
            meta: { original: { duration: 4.2 } },
          },
        ],
        card: { url: 'https://www.example.com/a', title: 'A' },
      },
      'hachyderm.io',
    );
    expect(post).not.toHaveProperty('metrics');
    expect(post).toMatchObject({
      authorName: 'm',
      handle: 'm@hachyderm.io',
      media: [
        {
          type: 'video',
          remoteUrl: 'https://x/v.mp4',
          remotePoster: 'https://x/p.jpg',
          duration: 4.2,
          alt: 'clip',
        },
      ],
      linkCard: { domain: 'example.com', title: 'A' },
    });
  });
});

describe('renderDocument', () => {
  it('shows a filing with its paragraph, highlight and links into the PDF', () => {
    const html = renderDocument({ data: FILING });
    expect(html).toContain('Complaint · O’Leary v. Armstrong · ¶27');
    expect(html).toContain('<span class="document-paragraph">27.</span>');
    expect(html).toContain('<mark>“Doesn’t everybody think it’s weird”</mark>');
    expect(html).toContain(
      'highlight mine · <a href="https://example.com/complaint.pdf#page=12">jump to ¶27 in PDF</a>',
    );
    expect(html).toContain(
      '<a href="https://www.courtlistener.com/docket/1/x/">docket</a>',
    );
  });

  it('shows a letter with its date, sender and recipient', () => {
    const html = renderDocument({
      data: {
        docType: 'letter',
        title: 'Letter',
        date: '2026-10-08',
        from: 'Senate PSI (minority)',
        to: 'Brandon Lutnick',
        excerptHtml: '…investigating…',
        pdfUrl: 'https://example.com/l.pdf',
        coverageUrl: 'https://www.citationneeded.news/x/',
      },
    });
    expect(html).toContain(
      'Oct 8, 2026 · Senate PSI (minority) → Brandon Lutnick',
    );
    expect(html).toContain('full document (PDF)');
    expect(html).toContain(
      'my coverage: <a href="https://www.citationneeded.news/x/">citationneeded.news</a>',
    );
    expect(html).not.toContain('highlight mine');
  });
});

describe('renderSocialPost', () => {
  it('draws one post as a card', () => {
    const html = renderSocialPost({
      data: { posts: [POST], screenshot: 'https://s/shot.png' },
    });
    expect(html).toContain(
      '<strong>CZ BNB</strong> <a href="https://bsky.app/profile/cz.bsky.social">@cz.bsky.social</a>',
    );
    expect(html).toContain('<span class="social-network">Bluesky</span>');
    expect(html).toContain('Loss might be a bit higher<br>but will cover.');
    expect(html).toContain('alt="A chart"');
    expect(html).toContain(
      'Image not archived · <a href="https://s/shot.png">see screenshot</a>',
    );
    expect(html).not.toMatch(/replies|likes/);
    expect(html).toContain('10:00 AM · Oct 29, 2025');
    expect(html).toContain(
      '<a href="https://bsky.app/profile/cz.bsky.social/post/abc">original</a> · <a href="https://s/shot.png">screenshot</a>',
    );
  });

  it('draws several posts as a thread, and calls Twitter Twitter', () => {
    const tweet = { ...POST, network: 'twitter', media: [], linkCard: null };
    const html = renderSocialPost({ data: { posts: [tweet, tweet] } });
    expect(html).toContain('Thread · 2 posts');
    expect(html).toContain('<span class="social-network">Twitter</span>');
    expect(html.match(/class="social-thread-post"/g)).toHaveLength(2);
  });

  it('cleans the stored text', () => {
    expect(
      renderSocialPost({
        data: {
          posts: [{ ...POST, media: [], textHtml: 'x<img src=a onerror=b>' }],
        },
      }),
    ).not.toContain('onerror');
  });
});

describe('comparisons and the other places blocks go', () => {
  const comparison = {
    type: 'comparison',
    data: {
      left: {
        label: 'The headline · Reuters',
        block: { type: 'paragraph', data: { text: 'Binance recovering' } },
      },
      right: {
        label: 'The source · @binance',
        block: { type: 'socialPost', data: { posts: [POST] } },
      },
    },
  };

  it('renders each side with its label', () => {
    const html = renderComparison(comparison, (b) => `<${b.type}>`);
    expect(html).toEqual(
      '<div class="comparison"><div class="comparison-side"><p class="comparison-label">The headline · Reuters</p><paragraph></div><div class="comparison-side"><p class="comparison-label">The source · @binance</p><socialPost></div></div>',
    );
  });

  it('builds thread text: labels, documents and posts as links', () => {
    const { posts } = buildThread(
      { blocks: [{ type: 'document', data: FILING }, comparison] },
      'mastodon',
    );
    expect(posts[0].text).toEqual(
      'Complaint · O’Leary v. Armstrong (https://example.com/complaint.pdf)<br><br>The headline · Reuters: Binance recovering<br><br>The source · @binance: CZ BNB’s post (https://bsky.app/profile/cz.bsky.social/post/abc)',
    );
  });

  it('finds links in documents, posts and both sides of a comparison', () => {
    expect(
      extractUrlsFromBlocks([{ type: 'document', data: FILING }, comparison]),
    ).toEqual([
      FILING.pdfUrl,
      FILING.docketUrl,
      POST.originalUrl,
      POST.linkCard.url,
    ]);
  });

  it('suggests a document’s PDF and docket as sources', () => {
    expect(suggestSources([{ type: 'document', data: FILING }])).toEqual([
      { label: 'Complaint · O’Leary v. Armstrong (PDF)', url: FILING.pdfUrl },
      { label: 'docket', url: FILING.docketUrl },
    ]);
  });

  it('reaches text inside comparisons, for mentions', () => {
    const mapped = mapPostText({ blocks: [comparison] }, (t) =>
      t.toUpperCase(),
    );
    expect(mapped.blocks[0].data.left.block.data.text).toEqual(
      'BINANCE RECOVERING',
    );
  });
});
