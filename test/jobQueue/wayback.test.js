import { extractUrlsFromBlocks } from '../../backend/helpers/links';
import { recentCaptureFromCdx, waybackFileUrl } from '../../jobQueue/wayback';

const HEADER = ['timestamp', 'original'];
const NOW = new Date(Date.UTC(2026, 10, 6, 12, 0, 0));

describe('recentCaptureFromCdx', () => {
  it('uses a capture from the last 30 days', () => {
    expect(
      recentCaptureFromCdx(
        [HEADER, ['20261101093000', 'https://example.com/']],
        NOW,
      ),
    ).toEqual({
      archiveUrl:
        'https://web.archive.org/web/20261101093000/https://example.com/',
      archivedAt: new Date(Date.UTC(2026, 10, 1, 9, 30, 0)),
    });
  });

  it('ignores older captures', () => {
    expect(
      recentCaptureFromCdx(
        [HEADER, ['20250101000000', 'https://example.com/']],
        NOW,
      ),
    ).toBeNull();
  });

  it('takes a capture of any age when asked', () => {
    expect(
      recentCaptureFromCdx(
        [HEADER, ['20190101000000', 'https://example.com/']],
        NOW,
        Infinity,
      )?.archiveUrl,
    ).toBe('https://web.archive.org/web/20190101000000/https://example.com/');
  });

  it('handles no captures and odd responses', () => {
    expect(recentCaptureFromCdx([], NOW)).toBeNull();
    expect(recentCaptureFromCdx([HEADER], NOW)).toBeNull();
    expect(recentCaptureFromCdx('nope', NOW)).toBeNull();
    expect(recentCaptureFromCdx([HEADER, ['garbage', 'x']], NOW)).toBeNull();
  });
});

describe('waybackFileUrl', () => {
  it('asks for the saved file, without the Wayback toolbar', () => {
    expect(
      waybackFileUrl(
        'https://web.archive.org/web/20240102030405/https://example.gov/a.pdf',
      ),
    ).toBe(
      'https://web.archive.org/web/20240102030405id_/https://example.gov/a.pdf',
    );
  });
});

describe('extractUrlsFromBlocks', () => {
  const blocks = [
    {
      type: 'paragraph',
      data: { text: 'See <a href="https://example.com/a">this</a>.' },
    },
    { type: 'embed', data: { source: 'https://twitter.com/x/status/1' } },
    { type: 'image', data: { file: { url: 'https://i/1.png' } } }, // No caption
  ];

  it('finds links, and embeds when asked', () => {
    expect(extractUrlsFromBlocks(blocks)).toEqual(['https://example.com/a']);
    expect(extractUrlsFromBlocks(blocks, { embeds: true })).toEqual([
      'https://example.com/a',
      'https://twitter.com/x/status/1',
    ]);
  });
});
