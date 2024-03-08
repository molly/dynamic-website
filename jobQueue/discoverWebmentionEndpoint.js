import axios from 'axios';
import * as cheerio from 'cheerio';
import { WEBMENTION_USER_AGENT } from './useragents.js';

// Find the webmention endpoint for a given URL
// Queue consumer handles errors
export default async (url) => {
  let endpoint;

  // First try to get the endpoint from the HTML headers
  const resp = await axios.get(url, {
    headers: { 'User-Agent': WEBMENTION_USER_AGENT },
    timeout: 5000,
    maxContentLength: 1000000, // 1MB
  });
  const headers = resp.headers;
  if (headers['link']) {
    const links = headers['link'].split(',');
    for (let link of links) {
      let [endpointUrl, rel] = link.split(/; ?/g);
      rel = rel.replace(/^rel="?|"$/g, '');
      if (rel.split(' ').some((el) => el.trim() === 'webmention')) {
        endpoint = endpointUrl;
        break;
      }
    }
  }

  // If the endpoint isn't included in the headers, look for <a> or <link> in the HTML
  // with rel="webmention"
  if (endpoint == undefined && headers['content-type'].includes('text/html')) {
    const $ = cheerio.load(resp.data);
    const links = $(
      'link[rel~="webmention"][href], a[rel~="webmention"][href]',
    );
    for (let link of links) {
      const $link = $(link);
      if (
        $link
          .attr('rel')
          .split(' ')
          .some((el) => el.trim() === 'webmention')
      ) {
        endpoint = $link.attr('href');
        break;
      }
    }
  }

  if (endpoint != undefined) {
    // Get absolute URL
    endpoint = endpoint.replace(/^ *<|> *$/g, '');
    return new URL(endpoint, url).href;
  }

  // Page doesn't have a proper webmention URL
  return null;
};
