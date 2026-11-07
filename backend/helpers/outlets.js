import { Entity } from '../models/entity.model.js';
import { normalizeDomain } from './entityKeys.js';

// Outlets are organization entities with `domains`. A reading or press entry gets the outlet whose
// domain matches its link, checked from the full host down, so "news.bbc.co.uk" finds an outlet
// listed under "bbc.co.uk".

export const OUTLET_FIELDS =
  'name type disambiguator domains paywalledByDefault';

/**
 * The host of a URL, normalized like stored outlet domains. Null for anything that isn't a web URL.
 * @param {string} url
 * @returns {?string}
 */
export function domainOf(url) {
  try {
    const { protocol, hostname } = new URL(url);
    return /^https?:$/.test(protocol) ? normalizeDomain(hostname) : null;
  } catch {
    return null;
  }
}

/**
 * The domain and each parent domain with at least two labels: "a.b.co.uk" -> ["a.b.co.uk",
 * "b.co.uk", "co.uk"].
 * @param {string} domain
 * @returns {string[]}
 */
export function candidateDomains(domain) {
  const labels = domain.split('.');
  return labels.slice(0, -1).map((_, i) => labels.slice(i).join('.'));
}

/**
 * The outlet for a link, preferring the most specific domain.
 * @param {string} url
 * @returns {Promise<?Object>}
 */
export async function outletForUrl(url) {
  const domain = domainOf(url);
  if (!domain) {
    return null;
  }
  const candidates = candidateDomains(domain);
  const outlets = await Entity.find(
    { domains: { $in: candidates } },
    OUTLET_FIELDS,
  ).lean();
  const rank = (outlet) =>
    Math.min(
      ...outlet.domains
        .map((d) => candidates.indexOf(d))
        .filter((index) => index >= 0),
    );
  return outlets.sort((a, b) => rank(a) - rank(b))[0] || null;
}

/**
 * Make an outlet the match for a link's domain from now on. Only organizations have domains.
 * @param {string} outletId
 * @param {string} url
 */
export async function addOutletDomain(outletId, url) {
  const domain = domainOf(url);
  const outlet = await Entity.findById(outletId);
  if (!domain || outlet?.type !== 'organization') {
    return;
  }
  if (!outlet.domains.includes(domain)) {
    outlet.domains.push(domain);
    await outlet.save();
  }
}
