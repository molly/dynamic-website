import { parsePostUrl } from '../../../api/helpers/postUrl';
import { suggestSources } from '../../../api/helpers/sources';
import {
  hydrateUpdates,
  linkCorrections,
  sortUpdates,
} from '../../../api/helpers/updates';
import {
  entryBlocks,
  entryMetadataUrls,
  entryPosts,
} from '../../../backend/helpers/links';

const paragraph = (text) => ({ type: 'paragraph', data: { text } });

describe('parsePostUrl', () => {
  it('reads Bluesky, Mastodon and Twitter post links', () => {
    expect(
      parsePostUrl('https://bsky.app/profile/molly.wiki/post/3mzop3pa3kc26'),
    ).toEqual({
      network: 'bluesky',
      handle: 'molly.wiki',
      rkey: '3mzop3pa3kc26',
    });
    expect(parsePostUrl('https://hachyderm.io/@molly0xfff/1175723')).toEqual({
      network: 'mastodon',
      host: 'hachyderm.io',
      handle: 'molly0xfff',
      id: '1175723',
    });
    expect(
      parsePostUrl('https://mastodon.social/@someone@example.org/42'),
    ).toMatchObject({ network: 'mastodon', handle: 'someone@example.org' });
    expect(parsePostUrl('https://x.com/molly0xFFF/status/123?s=20')).toEqual({
      network: 'twitter',
      handle: 'molly0xFFF',
      id: '123',
    });
  });

  it('rejects profiles and other links', () => {
    expect(parsePostUrl('https://bsky.app/profile/molly.wiki')).toBeNull();
    expect(parsePostUrl('https://example.com/@a/b')).toBeNull();
    expect(parsePostUrl('not a url')).toBeNull();
  });
});

describe('suggestSources', () => {
  const blocks = [
    paragraph(
      'Read <a href="https://storage.courtlistener.com/recap/gov.uscourts.dcd.1/1.0.pdf">the complaint</a> and the <a href="https://www.courtlistener.com/docket/123/sec-v-coinbase/">https://www.courtlistener.com/docket/123/sec-v-coinbase/</a>.',
    ),
    paragraph('Not a source: <a href="https://example.com/article">news</a>'),
    {
      type: 'list',
      data: {
        items: [
          'See <a href="https://www.sec.gov/Archives/edgar/data/1679788/x.htm">S-1</a>',
          'Again <a href="https://storage.courtlistener.com/recap/gov.uscourts.dcd.1/1.0.pdf">dup</a>',
        ],
      },
    },
  ];

  it('suggests document links, labelled from their text', () => {
    expect(suggestSources(blocks)).toEqual([
      {
        label: 'the complaint',
        url: 'https://storage.courtlistener.com/recap/gov.uscourts.dcd.1/1.0.pdf',
      },
      {
        label: 'docket',
        url: 'https://www.courtlistener.com/docket/123/sec-v-coinbase/',
      },
      {
        label: 'S-1',
        url: 'https://www.sec.gov/Archives/edgar/data/1679788/x.htm',
      },
    ]);
  });

  it('skips sources already on the post', () => {
    expect(
      suggestSources(blocks, [
        { url: 'https://www.courtlistener.com/docket/123/sec-v-coinbase/' },
      ]).map((s) => s.label),
    ).toEqual(['the complaint', 'S-1']);
  });
});

describe('updates', () => {
  const updates = [
    {
      _id: 'a',
      kind: 'update',
      at: '2026-11-02T10:00:00Z',
      body: { blocks: [paragraph('Second')] },
    },
    {
      _id: 'b',
      kind: 'live',
      headline: 'Ruling',
      at: '2026-11-03T10:00:00Z',
      body: { blocks: [] },
    },
    {
      _id: 'c',
      kind: 'correction',
      at: '2026-11-01T10:00:00Z',
      body: { blocks: [paragraph('First')] },
    },
  ];

  it('orders live posts newest first and others oldest first', () => {
    expect(sortUpdates(updates, true).map((u) => u._id)).toEqual([
      'b',
      'a',
      'c',
    ]);
    expect(sortUpdates(updates, false).map((u) => u._id)).toEqual([
      'c',
      'a',
      'b',
    ]);
  });

  it('prepares labels, headlines and bodies for the template', () => {
    const hydrated = hydrateUpdates(
      { updates, live: { status: 'updating' } },
      (post) => post.blocks.map((b) => `<p>${b.data.text}</p>`),
    );
    expect(hydrated[0]).toMatchObject({
      id: 'b',
      label: 'Live update',
      headline: 'Ruling',
      html: [],
    });
    expect(hydrated[2]).toMatchObject({
      id: 'c',
      label: 'Correction',
      headline: null,
      html: ['<p>First</p>'],
    });
  });

  it('links corrections to their notes, and only to notes that exist', () => {
    const html = [
      '<p>Has <del class="correction" data-update="c">50</del><ins class="correction" data-update="c">60</ins> and <ins class="correction" data-update="gone">x</ins></p>',
    ];
    const [linked] = linkCorrections(html, new Set(['c']));
    expect(linked).toContain(
      '60</ins><a class="correction-note" href="#update-c" title="See the correction note">†</a>',
    );
    expect(linked).not.toContain('#update-gone');
  });
});

describe('entry links', () => {
  const entry = {
    post: { blocks: [paragraph('main')] },
    updates: [{ body: { blocks: [paragraph('update')] } }, { body: null }],
    sources: [{ label: 'docket', url: 'https://example.com/docket' }],
    data: { label: 'data', url: 'https://example.com/data' },
    inReplyTo: { url: 'https://bsky.app/profile/a/post/b' },
  };

  it('includes update bodies with the main post', () => {
    expect(entryPosts(entry)).toHaveLength(2);
    expect(entryBlocks(entry).map((b) => b.data.text)).toEqual([
      'main',
      'update',
    ]);
  });

  it('collects sources, data and the reply link', () => {
    expect(entryMetadataUrls(entry)).toEqual([
      'https://example.com/docket',
      'https://example.com/data',
      'https://bsky.app/profile/a/post/b',
    ]);
  });
});
