import {
  renderArticleCard,
  renderQuote,
  renderRoundup,
} from '../../../api/helpers/blocks';
import {
  formatGallery,
  formatMedia,
  imageSourceLine,
} from '../../../api/helpers/media';
import { extractUrlsFromBlocks } from '../../../backend/helpers/links';
import { textFragmentUrl } from '../../../backend/helpers/postContext';

const NYT = {
  title: 'ChatGPT’s Advice to Cut Her Seizure Drug',
  href: 'https://www.nytimes.com/2026/10/28/x.html',
  work: 'The New York Times',
  author: 'A Reporter',
  completed: '2025-10-28',
};
const ARCHIVE = 'https://web.archive.org/web/2026/nyt';

describe('linked article card', () => {
  it('marks a paywalled article and points to the archived copy', () => {
    const html = renderArticleCard(
      { ...NYT, outlet: { paywalledByDefault: true } },
      { archived: { [NYT.href]: ARCHIVE } },
    );
    expect(html).toContain('class="article-card paywalled"');
    expect(html).toContain('paywall</span>');
    expect(html).toContain(
      `read Oct 28, 2025 · <a href="${ARCHIVE}">archived copy</a>`,
    );
  });

  it('makes a gift link the main way in', () => {
    const html = renderArticleCard(
      { ...NYT, paywalled: true, giftLink: 'https://nyti.ms/gift' },
      { archived: { [NYT.href]: ARCHIVE } },
    );
    expect(html).toContain(
      '<a class="article-card-gift" href="https://nyti.ms/gift">free gift link ↗</a> · <a href="https://web.archive.org/web/2026/nyt">archived</a>',
    );
  });

  it('lets an entry say it isn’t paywalled even when its outlet usually is', () => {
    const html = renderArticleCard({
      ...NYT,
      paywalled: false,
      outlet: { paywalledByDefault: true },
    });
    expect(html).not.toContain('paywall');
  });
});

describe('roundup', () => {
  const items = [
    { line: 'One', snapshot: { ...NYT, href: 'https://a/1' } },
    { line: 'Two', snapshot: { ...NYT, href: 'https://a/2' } },
  ];
  it('says "all archived" only when every link is', () => {
    expect(
      renderRoundup({
        data: { items },
        archived: { 'https://a/1': 'w1', 'https://a/2': 'w2' },
      }),
    ).toContain('<p class="roundup-footer">2 links · all archived</p>');
    expect(
      renderRoundup({ data: { items }, archived: { 'https://a/1': 'w1' } }),
    ).toContain('<p class="roundup-footer">2 links</p>');
  });
});

describe('quotes', () => {
  it('pulls highlighted words out large, and links to the passage', () => {
    const html = renderQuote({
      data: {
        text: '<mark>If you are reading this</mark> On some level, you know this.',
        caption: 'Laura Jedeed',
        contextUrl: 'https://slate.com/x#:~:text=If',
      },
    });
    expect(html).toEqual(
      '<figure class="quote has-pull"><blockquote><p class="pull-quote">If you are reading this</p><p>On some level, you know this.</p></blockquote><figcaption><cite>– Laura Jedeed</cite></figcaption><p class="quote-context"><a href="https://slate.com/x#:~:text=If">↗ read in context</a></p></figure>',
    );
  });

  it('builds a link to a passage from its first words', () => {
    expect(
      textFragmentUrl(
        'https://slate.com/a#top',
        '<p>I’ve always operated in a weird, self-made space</p>',
      ),
    ).toEqual(
      'https://slate.com/a#:~:text=I%E2%80%99ve%20always%20operated%20in%20a%20weird%2C',
    );
  });
});

describe('images', () => {
  it('says where a screenshot came from, with the archived page and its alt text', () => {
    const html = formatMedia({
      data: {
        file: { url: 'https://s/shot.png' },
        alt: 'FCC page saying the record is closed',
      },
      tunes: {
        imageSource: {
          sourceUrl: 'https://www.fcc.gov/x',
          screenshot: true,
          capturedAt: '2025-11-01',
        },
      },
      archived: { 'https://www.fcc.gov/x': 'https://web.archive.org/fcc' },
    });
    expect(html).toContain(
      '<p class="media-source">screenshot · <a href="https://www.fcc.gov/x">fcc.gov</a> · captured Nov 1, 2025 · <a href="https://web.archive.org/fcc">archived page</a></p>',
    );
    expect(html).toContain(
      '<p class="media-alt">FCC page saying the record is closed</p>',
    );
  });

  it('credits a source image and links to the full size', () => {
    expect(
      imageSourceLine(
        {
          sourceName: 'Tech Influence Watch',
          sourceUrl: 'https://tiw.example/',
        },
        { file: 'https://s/chart.png' },
      ),
    ).toEqual(
      '<p class="media-source">from <a href="https://tiw.example/">Tech Influence Watch</a> · <a href="https://s/chart.png">full size</a></p>',
    );
    expect(imageSourceLine({})).toEqual('');
  });

  it('numbers gallery captions', () => {
    const html = formatGallery({
      data: {
        files: [
          { url: 'https://s/1.png', caption: 'Fairshake network' },
          { url: 'https://s/2.png', caption: 'Leading the Future' },
        ],
      },
    });
    expect(html).toContain('<figcaption>1/2 · Fairshake network</figcaption>');
    expect(html).toContain('<figcaption>2/2 · Leading the Future</figcaption>');
  });

  it('counts where an image came from as a link in the post', () => {
    expect(
      extractUrlsFromBlocks([
        {
          type: 'image',
          data: { caption: '' },
          tunes: { imageSource: { sourceUrl: 'https://www.fcc.gov/x' } },
        },
      ]),
    ).toEqual(['https://www.fcc.gov/x']);
  });
});
