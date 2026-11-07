import {
  formatReadDate,
  renderArticle,
  renderMedia,
  renderRoundup,
  renderTable,
} from '../../../api/helpers/blocks';
import { fingerprintPost } from '../../../api/helpers/socialThreads';
import { extractUrlsFromBlocks } from '../../../backend/helpers/links';
import { processText } from '../../../backend/helpers/social';
import { buildThread } from '../../../frontend/js/threads/buildThread';

const SNAPSHOT = {
  title: 'Coinbase Scored Another Federal Contract',
  href: 'https://example.com/coinbase',
  work: 'The Washington Sun',
  author: 'Taylor Giorno',
};

describe('renderTable', () => {
  const data = {
    withHeadings: true,
    totalRow: true,
    source: 'FEC filings',
    asOf: '2026-11-01',
    content: [
      ['Spender', 'Type', 'Amount'],
      ['Fairshake', 'super PAC', '$141M'],
      ['Coinbase', 'company', '$75.5M'],
      ['Total', '', '$216.5M'],
    ],
  };
  const html = renderTable({ data });

  it('renders a header row and marks the total', () => {
    expect(html).toContain('<thead><tr><th>Spender</th>');
    expect(html).toContain('<tr class="total">');
  });

  it('right-aligns numeric columns only', () => {
    expect(html).toContain('<td class="numeric">$141M</td>');
    expect(html).toContain('<td>Fairshake</td>');
  });

  it('adds the source, date and a CSV of the cells', () => {
    expect(html).toContain('source: FEC filings · as of Nov 1, 2026');
    const csv = decodeURIComponent(html.match(/charset=utf-8,([^"]+)"/)[1]);
    expect(csv.split('\n')[1]).toEqual('"Fairshake","super PAC","$141M"');
  });
});

describe('renderArticle', () => {
  it('uses the current entry, with excerpts and the read date', () => {
    const html = renderArticle({
      data: {
        excerpts: ['Since 2024, the FEC has failed to rule.'],
        snapshot: { ...SNAPSHOT, title: 'Old title' },
        entry: { ...SNAPSHOT, completed: '2026-10-30' },
      },
    });
    expect(html).toContain(
      '<p class="article-card-meta">The Washington Sun · Taylor Giorno</p>',
    );
    expect(html).toContain(`<a href="${SNAPSHOT.href}">${SNAPSHOT.title}</a>`);
    expect(html).toContain('Since 2024, the FEC has failed to rule.');
    expect(html).toContain('read Oct 30, 2026');
  });

  it('falls back to the snapshot when the entry is gone', () => {
    expect(
      renderArticle({ data: { snapshot: SNAPSHOT, excerpts: [] } }),
    ).toContain(SNAPSHOT.title);
  });
});

describe('renderRoundup and renderMedia', () => {
  it('lists items with lines and a count', () => {
    const html = renderRoundup({
      data: {
        items: [
          { snapshot: SNAPSHOT, line: 'Worth reading.' },
          { snapshot: SNAPSHOT },
        ],
      },
    });
    expect(html).toContain('<p class="roundup-line">Worth reading.</p>');
    expect(html).toContain('2 links');
  });

  it('renders audio and video players with duration', () => {
    expect(
      renderMedia({
        data: {
          url: 'https://s/a.mp3',
          kind: 'audio',
          duration: 3150,
          caption: 'Episode 12',
        },
      }),
    ).toContain(
      '<audio controls preload="metadata" src="https://s/a.mp3"></audio><figcaption>Episode 12 · 52:30</figcaption>',
    );
    expect(
      renderMedia({
        data: {
          url: 'https://s/v.mp4',
          kind: 'video',
          poster: 'https://s/p.jpg',
        },
      }),
    ).toContain('poster="https://s/p.jpg"');
  });

  it('formats partial dates', () => {
    expect(formatReadDate('2026-10')).toEqual('October 2026');
    expect(formatReadDate('2026')).toEqual('2026');
  });
});

describe('cross-posting new blocks and marks', () => {
  it('keeps only the corrected wording, and drops highlights', () => {
    const text =
      'The company has <del class="correction">50</del><ins class="correction">60</ins> staff and <mark>a lot</mark> of debt';
    expect(processText(text, 'twitter').text).toEqual(
      'The company has 60 staff and a lot of debt',
    );
  });

  it('turns article cards and roundups into thread text', () => {
    const thread = buildThread(
      {
        blocks: [
          { type: 'article', data: { snapshot: SNAPSHOT } },
          {
            type: 'roundup',
            data: { items: [{ snapshot: SNAPSHOT, line: 'Must read.' }] },
          },
          { type: 'table', data: { content: [['a']] } },
        ],
      },
      'mastodon',
    );
    expect(thread.posts[0].text).toEqual(
      `${SNAPSHOT.title} (${SNAPSHOT.href})<br><br>${SNAPSHOT.title} (${SNAPSHOT.href}) — Must read.`,
    );
  });

  it('finds links in cards, roundups and tables', () => {
    expect(
      extractUrlsFromBlocks([
        { type: 'article', data: { snapshot: SNAPSHOT } },
        {
          type: 'roundup',
          data: { items: [{ snapshot: { href: 'https://example.com/r' } }] },
        },
        {
          type: 'table',
          data: { content: [['<a href="https://example.com/t">t</a>']] },
        },
      ]),
    ).toEqual([
      SNAPSHOT.href,
      'https://example.com/r',
      'https://example.com/t',
    ]);
  });
});

describe('galleries', () => {
  const gallery = (alt = 'A chart') => ({
    type: 'gallery',
    data: {
      caption: 'See <a href="https://example.com/g">source</a>',
      files: [
        { url: 'https://s/1.png', alt, caption: '' },
        {
          url: 'https://s/2.png',
          alt: '',
          caption: '<a href="https://example.com/i">via</a>',
        },
      ],
    },
  });

  it('cross-posts each image with its alt text', () => {
    const thread = buildThread(
      { blocks: [{ type: 'paragraph', data: { text: 'Hi' } }, gallery()] },
      'bluesky',
    );
    expect(thread.posts[0].media).toEqual([
      { url: 'https://s/1.png', alt: 'A chart' },
      { url: 'https://s/2.png', alt: '' },
    ]);
  });

  it('counts gallery alt text as a change to the main post', () => {
    expect(fingerprintPost({ blocks: [gallery()] })).not.toEqual(
      fingerprintPost({ blocks: [gallery('A bar chart')] }),
    );
  });

  it('finds links in gallery and image captions', () => {
    expect(extractUrlsFromBlocks([gallery()])).toEqual([
      'https://example.com/g',
      'https://example.com/i',
    ]);
  });
});
