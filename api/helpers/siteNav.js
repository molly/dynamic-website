// The site's navigation: the pages in the header bar, and everything in the Menu, as one tree
// (pug/templates/includes/siteHeader.pug, siteMenu.pug). website-v3 keeps the same tree in
// src/_data/siteNav.js; change both together.
//
// The bar is one row at every width. Links drop out at fixed widths (CSS only, css/site.css):
// "desktop" ones show only from 1240px, "tablet" ones from 640px, the rest always. Below 640px the
// wordmark stands in for Home. Whatever drops out is still in the Menu.

const item = (text, href, extra = {}) => ({
  text,
  href,
  // Internal pages are known by their first path segment: "/press" is "press", "/" is "home"
  key: href.startsWith('/') ? href.slice(1).split('/')[0] || 'home' : null,
  ...extra,
});

// The Menu: groups of top-level pages, each with the pages under it
export const SITE_MENU = [
  [item('Home', '/'), item('Feed', '/feed')],
  [
    item('Work', '/work', {
      children: [
        item('Citation Needed', 'https://www.citationneeded.news/', {
          italic: true,
        }),
        item('Web3 is Going Just Great', 'https://www.web3isgoinggreat.com/', {
          italic: true,
        }),
        item('Tech Influence Watch', 'https://influence.citationneeded.news/', {
          italic: true,
        }),
        item('Freelance writing', '/freelance'),
        item('Speaking', '/speaking'),
        item('Press', '/press'),
      ],
    }),
  ],
  [
    item('About', '/about', {
      children: [
        item('Reading', '/reading'),
        item('Contact', '/contact'),
        item('Identity', '/verify'),
        item('Resumé', '/resume'),
        item('Blogroll', '/blogroll'),
        item('Software', '/projects'),
      ],
    }),
  ],
  [
    item('Support', '/support', {
      children: [item('Store', 'https://store.mollywhite.net/')],
    }),
  ],
  [
    item('Social', '/social', {
      children: [
        item('Microblog', '/micro'),
        item('Bluesky', 'https://bsky.app/profile/molly.wiki', { me: true }),
        item('Twitter', 'https://x.com/molly0xFFF', { me: true }),
        item('Mastodon', 'https://hachyderm.io/@molly0xfff', { me: true }),
        item('YouTube', 'https://www.youtube.com/@molly0xfff', { me: true }),
      ],
    }),
  ],
];

// The bar, in order, with the width each link is shown from (none: always)
export const SITE_BAR = [
  item('Home', '/', { from: 'tablet' }),
  item('Feed', '/feed', { from: 'tablet' }),
  item('Work', '/work'),
  item('Press', '/press', { from: 'desktop' }),
  item('Reading', '/reading', { from: 'desktop' }),
  item('About', '/about'),
  item('Contact', '/contact', { from: 'desktop' }),
  item('Support', '/support', { from: 'desktop' }),
];

/**
 * Where a page sits in the navigation: its own key, and the key of the top-level page it's under
 * ("press" is under "work"). The bar underlines that parent wherever the page's own link isn't
 * shown: always, when the page isn't in the bar, or below 1240px, when its link drops out there.
 * @param {?string} current A page's key ("press"), or null
 * @returns {{current: ?string, parent: ?string, parentFrom: ?('always'|'narrow')}}
 */
export function navState(current) {
  const top = SITE_MENU.flat().find((entry) =>
    (entry.children || []).some((child) => child.key === current),
  );
  if (!current || !top) {
    return { current: current || null, parent: null, parentFrom: null };
  }
  const inBar = SITE_BAR.find((entry) => entry.key === current);
  return {
    current,
    parent: top.key,
    parentFrom: inBar ? 'narrow' : 'always',
  };
}
