import * as cheerio from 'cheerio';

// An entry's HTML as it goes in the RSS feeds. The feeds use the site's own block HTML, but feed
// readers don't load the site's CSS or scripts and only follow absolute links, and many strip
// elements they don't know. So:
//  - links and image sources relative to the site (mentions' entity pages) become absolute
//  - <template>s go: a document's full passage, which the post page's script shows, would
//    otherwise appear twice where a reader unwraps it
//  - video and audio get a plain link to the file after them, since many readers drop players
//  - data: links (a table's CSV download) go, since readers drop them and leave their text behind

const SITE = 'https://www.mollywhite.net';
const URL_ATTRIBUTES = ['href', 'src', 'poster'];

/**
 * @param {string} html
 * @returns {string}
 */
export function rssHtml(html) {
  const $ = cheerio.load(html, null, false);

  $(URL_ATTRIBUTES.map((name) => `[${name}]`).join(', ')).each((_, el) => {
    for (const name of URL_ATTRIBUTES) {
      const value = $(el).attr(name);
      if (value && value.startsWith('/') && !value.startsWith('//')) {
        $(el).attr(name, `${SITE}${value}`);
      }
    }
  });

  $('template').remove();

  $('a[href^="data:"]').each((_, el) => {
    const parent = $(el).parent();
    // The separator before it, in a caption like "source: FEC · csv"
    const before = el.prev;
    if (before?.type === 'text') {
      before.data = before.data.replace(/\s*·\s*$/, '');
    }
    $(el).remove();
    // A caption that was only the download link
    if (parent.is('figcaption') && !parent.text().trim()) {
      parent.remove();
    }
  });

  $('video[src], audio[src]').each((_, el) => {
    const link = $('<a>')
      .attr('href', $(el).attr('src'))
      .text(el.tagName === 'video' ? 'Watch the video' : 'Listen to the audio');
    $(el).after($('<p>').append(link));
  });

  return $.html();
}
