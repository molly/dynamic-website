// Keys used to spot duplicate entities before they're created. See "Avoiding duplicate entities"
// in the editor plan.

const LEGAL_SUFFIXES = new Set([
  'inc',
  'incorporated',
  'llc',
  'ltd',
  'limited',
  'corp',
  'corporation',
  'co',
  'company',
  'plc',
  'pbc',
  'lp',
  'llp',
  'gmbh',
  'ag',
  'sa',
  'nv',
  'bv',
]);

/**
 * Normalize a name for comparison: lowercase, no accents or punctuation, "&" read as "and", and
 * no leading "the", trailing possessive or trailing legal suffixes ("Coinbase Global, Inc." ->
 * "coinbase global", "Taylor Lorenz’s" -> "taylor lorenz").
 * @param {string} name
 * @returns {string}
 */
export function nameKey(name) {
  const words = name
    .trim()
    .replace(/['\u2019]s$/i, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  if (words.length > 1 && words[0] === 'the') {
    words.shift();
  }
  while (words.length > 1 && LEGAL_SUFFIXES.has(words[words.length - 1])) {
    words.pop();
  }
  return words.join(' ');
}

/**
 * One key per account, so the same handle (or website) can't belong to two entities. A website is
 * the same site with or without its protocol, "www." or a trailing slash.
 * @param {string} network
 * @param {string} handle
 * @returns {string}
 */
export function accountKey(network, handle) {
  const key = handle.trim().replace(/^@/, '').toLowerCase();
  if (network === 'website') {
    return `website:${key
      .replace(/^[a-z]+:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/+$/, '')}`;
  }
  return `${network}:${key}`;
}

/**
 * Normalize a website domain: lowercase, no protocol, path or leading "www.".
 * @param {string} domain
 * @returns {string}
 */
export function normalizeDomain(domain) {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');
}

/**
 * URL slug from a name: "Coinbase Global, Inc." -> "coinbase-global".
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  return nameKey(text).replace(/ /g, '-');
}
