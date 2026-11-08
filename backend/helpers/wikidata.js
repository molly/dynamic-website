import axios from 'axios';

import { wikidataId } from '../../api/helpers/wikidata.js';
import { wikipediaArticleUrl } from '../../api/helpers/wikipedia.js';
import { USER_AGENT } from '../config/requests.js';

// Fetching Wikidata entries, for filling in entities (api/helpers/wikidata.js reads them).

const API = 'https://www.wikidata.org/w/api.php';
const ENTITY_DATA = 'https://www.wikidata.org/wiki/Special:EntityData/';
const request = { headers: { 'User-Agent': USER_AGENT }, timeout: 20000 };

/**
 * The Wikidata ID for a Wikipedia article (any language), from the article's site link.
 * @param {string} article A link to the article, or an English Wikipedia title
 * @returns {Promise<?string>}
 */
export async function wikidataIdForArticle(article) {
  const url = wikipediaArticleUrl(article);
  if (!url) {
    return null;
  }
  const [, language, path] =
    /^https:\/\/([a-z-]+)\.wikipedia\.org\/wiki\/(.+)$/.exec(url);
  const { data } = await axios.get(API, {
    ...request,
    params: {
      action: 'wbgetentities',
      sites: `${language.replace(/-/g, '_')}wiki`,
      titles: decodeURIComponent(path).replace(/_/g, ' '),
      props: 'info',
      normalize: 1,
      redirects: 'yes',
      format: 'json',
    },
  });
  return Object.keys(data.entities || {}).find((id) => wikidataId(id)) || null;
}

/**
 * A Wikidata entry. A merged (redirected) ID gives the entry it now points to.
 * @param {string} id e.g. Q434706
 * @returns {Promise<Object>}
 */
export async function fetchWikidataEntry(id) {
  const qid = wikidataId(id);
  if (!qid) {
    throw new Error(
      'That isn’t a Wikidata ID (e.g. Q434706) or a link to one.',
    );
  }
  try {
    const { data } = await axios.get(`${ENTITY_DATA}${qid}.json`, request);
    const entries = Object.values(data.entities || {});
    if (!entries.length) {
      throw new Error(`Wikidata has no entry ${qid}.`);
    }
    return entries[0];
  } catch (err) {
    if (err.response?.status === 404) {
      throw new Error(`Wikidata has no entry ${qid}.`, { cause: err });
    }
    throw err;
  }
}
