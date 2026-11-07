import {
  documentFrequencies,
  rankRelated,
  rarity,
  relatedScore,
} from '../../../api/helpers/relatedScore';

const day = (d) => new Date(Date.UTC(2026, 0, 1) + d * 24 * 60 * 60 * 1000);
const entry = (id, { tags = [], about = [], threads = [], at = 0 } = {}) => ({
  _id: id,
  tags,
  about,
  threads,
  createdAt: day(at),
});

// 20 entries: "common" tag on most of them, "rare" on two, entities likewise.
const filler = Array.from({ length: 16 }, (_, i) =>
  entry(`f${i}`, { tags: ['common'], about: ['fec'] }),
);
const target = entry('t', {
  tags: ['common', 'rare'],
  about: ['fec', 'grewal'],
});
const index = [
  ...filler,
  target,
  entry('rareTag', { tags: ['rare'] }),
  entry('rareEntity', { about: ['grewal'] }),
  entry('commonOnly', { tags: ['common'] }),
];
const frequencies = documentFrequencies(index);

describe('related scores', () => {
  it('weights rare things over common ones', () => {
    expect(rarity(2, 20)).toBeGreaterThan(rarity(16, 20));
    expect(relatedScore(target, index.at(-3), frequencies)).toBeGreaterThan(
      relatedScore(target, index.at(-1), frequencies),
    );
  });

  it('counts a shared entity for more than a shared tag of the same rarity', () => {
    expect(relatedScore(target, index.at(-2), frequencies)).toBeGreaterThan(
      relatedScore(target, index.at(-3), frequencies),
    );
  });

  it('gives a small bonus for being close in time', () => {
    const soon = entry('soon', { tags: ['rare'], at: 2 });
    const old = entry('old', { tags: ['rare'], at: -2000 });
    const near = relatedScore(target, soon, frequencies);
    const far = relatedScore(target, old, frequencies);
    expect(near).toBeGreaterThan(far);
    expect(near / far).toBeLessThan(1.6); // A bonus, not the main thing
  });

  it('never relates entries in the same thread, or ones sharing nothing', () => {
    expect(
      relatedScore(
        entry('a', { tags: ['rare'], threads: ['th'] }),
        entry('b', { tags: ['rare'], threads: ['th'] }),
        frequencies,
      ),
    ).toEqual(0);
    expect(
      relatedScore(target, entry('x', { tags: ['other'] }), frequencies),
    ).toEqual(0);
  });

  it('ranks above the minimum, best first, without the post itself', () => {
    const ranked = rankRelated(target, index, frequencies, {
      min: 1,
      limit: 3,
    });
    expect(ranked.map((r) => r.entry)).toEqual(['rareEntity', 'rareTag']);
    expect(rankRelated(target, index, frequencies, { min: 100 })).toEqual([]);
  });
});
