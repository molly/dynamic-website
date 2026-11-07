// Scoring which entries are related to a post, for the "Related" list on its page.
//  - Shared "about" entities count most, shared tags less. Each is weighted by rarity, so a rarely
//    mentioned entity (Paul Grewal) counts for more than a common one (FEC), and #coinbase for
//    more than #us-politics.
//  - Closeness in time multiplies the overlap a little, so an old entry only wins on strong overlap.
//  - Entries in the same thread are already on the page, so they're never related.

export const RELATED_WEIGHTS = {
  entity: 2,
  tag: 1,
  timeBoost: 0.5, // At most +50% for entries posted at the same time
  timeScaleDays: 365, // The boost falls to about a third after a year
};

// Below this, a match is too weak to show. Set from the scores report
// (backend/scripts/relatedReport.js): two shared mid-rarity tags (crypto lobby + US politics) score
// about 5.8 and one rare tag about 5-7, while one common tag (US politics) is about 2.6.
export const MIN_RELATED_SCORE = 5;

// How many to store per post: the page shows up to 3, after skipping ones already on it.
export const RELATED_STORED = 6;

const DAY = 24 * 60 * 60 * 1000;
const idsOf = (list) => new Set((list || []).map((id) => String(id)));

/**
 * How rare something is among n entries, when df of them have it.
 * @param {number} df
 * @param {number} n
 */
export const rarity = (df, n) => Math.log((n + 1) / (df + 1));

/**
 * Count how many entries have each tag and each entity.
 * @param {{tags?: Object[], about?: Object[]}[]} entries
 */
export function documentFrequencies(entries) {
  const tags = new Map();
  const entities = new Map();
  const add = (map, ids) =>
    ids.forEach((id) => map.set(id, (map.get(id) || 0) + 1));
  for (const entry of entries) {
    add(tags, idsOf(entry.tags));
    add(entities, idsOf(entry.about));
  }
  return { tags, entities, n: entries.length };
}

/**
 * Score one candidate against a post. 0 when they share nothing, or a thread.
 * @param {{tags, about, threads, createdAt}} target
 * @param {{tags, about, threads, createdAt}} candidate
 * @param {{tags: Map, entities: Map, n: number}} frequencies
 */
export function relatedScore(
  target,
  candidate,
  frequencies,
  weights = RELATED_WEIGHTS,
) {
  const targetThreads = idsOf(target.threads);
  if ([...idsOf(candidate.threads)].some((id) => targetThreads.has(id))) {
    return 0;
  }
  const shared = (key, map, weight) => {
    const mine = idsOf(target[key]);
    return [...idsOf(candidate[key])]
      .filter((id) => mine.has(id))
      .reduce(
        (sum, id) => sum + weight * rarity(map.get(id) || 1, frequencies.n),
        0,
      );
  };
  const overlap =
    shared('about', frequencies.entities, weights.entity) +
    shared('tags', frequencies.tags, weights.tag);
  if (overlap <= 0) {
    return 0;
  }
  const days =
    Math.abs(new Date(target.createdAt) - new Date(candidate.createdAt)) / DAY;
  return (
    overlap * (1 + weights.timeBoost * Math.exp(-days / weights.timeScaleDays))
  );
}

/**
 * The entries most related to a post, best first, above the minimum score.
 * @param {Object} target A feed entry: { _id, tags, about, threads, createdAt }
 * @param {Object[]} candidates Feed entries that could be related
 * @param {{tags: Map, entities: Map, n: number}} frequencies From documentFrequencies
 * @returns {{entry: *, score: number}[]}
 */
export function rankRelated(
  target,
  candidates,
  frequencies,
  { min = MIN_RELATED_SCORE, limit = RELATED_STORED } = {},
) {
  return candidates
    .filter((candidate) => String(candidate._id) !== String(target._id))
    .map((candidate) => ({
      entry: candidate._id,
      score: relatedScore(target, candidate, frequencies),
    }))
    .filter(({ score }) => score >= min)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
