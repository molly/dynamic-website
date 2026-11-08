import { rssHtml } from '../../../backend/helpers/rssHtml';

describe('rssHtml', () => {
  it('makes links to the site absolute', () => {
    expect(
      rssHtml(
        '<a href="/entities/organizations/coinbase">Coinbase</a> <a href="https://x.com/a">x</a> <img src="/assets/a.png">',
      ),
    ).toBe(
      '<a href="https://www.mollywhite.net/entities/organizations/coinbase">Coinbase</a> <a href="https://x.com/a">x</a> <img src="https://www.mollywhite.net/assets/a.png">',
    );
    expect(rssHtml('<a href="//cdn.example/a">a</a>')).toBe(
      '<a href="//cdn.example/a">a</a>',
    );
  });

  it('drops a document’s hidden full passage', () => {
    expect(
      rssHtml(
        '<div class="document-excerpt"><mark>Key</mark></div><template><div>Key, in full</div></template>',
      ),
    ).toBe('<div class="document-excerpt"><mark>Key</mark></div>');
  });

  it('drops data: download links, and their separator or empty caption', () => {
    expect(
      rssHtml(
        '<figcaption>source: FEC · <a href="data:text/csv,a" download="t.csv">csv</a></figcaption>',
      ),
    ).toBe('<figcaption>source: FEC</figcaption>');
    expect(
      rssHtml(
        '<figure><table></table><figcaption><a href="data:text/csv,a">csv</a></figcaption></figure>',
      ),
    ).toBe('<figure><table></table></figure>');
  });

  it('adds a link to video and audio files', () => {
    expect(
      rssHtml('<video controls src="https://s/v.mp4?a=1&amp;b=2"></video>'),
    ).toContain(
      '</video><p><a href="https://s/v.mp4?a=1&amp;b=2">Watch the video</a></p>',
    );
    expect(rssHtml('<audio controls src="https://s/a.mp3"></audio>')).toContain(
      '<a href="https://s/a.mp3">Listen to the audio</a>',
    );
  });
});
