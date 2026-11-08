import {
  fillFromWikidata,
  wikidataId,
  wikidataSuggestions,
} from '../../../api/helpers/wikidata';

// Trimmed from Wikidata's own entries
const claim = (value, { rank = 'normal', qualifiers } = {}) => ({
  rank,
  mainsnak: { datavalue: { value } },
  ...(qualifiers ? { qualifiers } : {}),
});
const WARREN = {
  id: 'Q434706',
  labels: { en: { value: 'Elizabeth Warren' } },
  descriptions: { en: { value: 'American politician and academic' } },
  aliases: {
    en: [{ value: 'Elizabeth Ann Warren' }, { value: 'Sen. Warren' }],
  },
  sitelinks: { enwiki: { title: 'Elizabeth Warren' } },
  claims: {
    P2002: [claim('ewarren'), claim('SenWarren')],
    P12361: [claim('elizabeth-warren.bsky.social')],
    P7085: [claim('oldaccount', { qualifiers: { P582: [{}] } })], // No longer used
    P4033: [claim('ewarren@mastodon.example', { rank: 'deprecated' })],
    P856: [
      claim('https://elizabethwarren.com/'),
      claim('https://www.warren.senate.gov/', { rank: 'preferred' }),
    ],
    P1839: [claim('S2MA00170')],
  },
};
const COINBASE = {
  id: 'Q16972754',
  labels: { en: { value: 'Coinbase' } },
  aliases: { en: [{ value: 'Coinbase Global' }] },
  sitelinks: { enwiki: { title: 'Coinbase' } },
  claims: {
    P5531: [claim('0001679788')],
    P414: [
      claim(
        { id: 'Q82059' },
        { qualifiers: { P249: [{ datavalue: { value: 'COIN' } }] } },
      ),
    ],
    P1448: [claim({ text: 'Coinbase Global, Inc.', language: 'en' })],
  },
};

describe('wikidataId', () => {
  it('reads an ID or a link to the entry', () => {
    expect(wikidataId('Q434706')).toBe('Q434706');
    expect(wikidataId('q434706')).toBe('Q434706');
    expect(wikidataId('https://www.wikidata.org/wiki/Q434706')).toBe('Q434706');
    expect(wikidataId('https://en.wikipedia.org/wiki/Q')).toBeNull();
    expect(wikidataId('')).toBeNull();
  });
});

describe('wikidataSuggestions', () => {
  it('takes current accounts, the preferred website, the article and the FEC run', () => {
    const s = wikidataSuggestions(WARREN, 'person');
    expect(s.ids).toEqual({
      wikidata: 'Q434706',
      wikipedia: 'https://en.wikipedia.org/wiki/Elizabeth_Warren',
      website: 'https://www.warren.senate.gov/',
    });
    expect(s.accounts).toEqual([
      { network: 'twitter', handle: 'ewarren' },
      { network: 'twitter', handle: 'SenWarren' },
      { network: 'bluesky', handle: 'elizabeth-warren.bsky.social' },
    ]); // Not the ended TikTok or the deprecated Mastodon account
    expect(s.candidacies).toEqual([
      { fecCandidateId: 'S2MA00170', office: 'senate', state: 'MA' },
    ]);
    expect(s).not.toHaveProperty('description');
    expect(s).not.toHaveProperty('secCik'); // Not a person's field
  });

  it('takes a company’s SEC CIK and legal name', () => {
    const s = wikidataSuggestions(COINBASE, 'organization');
    expect(s.secCik).toBe('0001679788');
    expect(s).not.toHaveProperty('ticker');
    expect(s.aliases.map((a) => a.name)).toEqual([
      'Coinbase',
      'Coinbase Global, Inc.',
      'Coinbase Global',
    ]);
  });
});

describe('fillFromWikidata', () => {
  it('fills only what’s empty, and adds accounts and names not already there', () => {
    const current = {
      name: 'Elizabeth Warren',
      description: 'Senator from Massachusetts',
      ids: { website: 'https://elizabethwarren.com/' },
      accounts: [{ network: 'twitter', handle: '@senwarren' }],
      aliases: [{ name: 'Sen. Warren' }],
    };
    const { entity, added } = fillFromWikidata(
      current,
      wikidataSuggestions(WARREN, 'person'),
    );
    expect(entity.description).toBe('Senator from Massachusetts');
    expect(entity.ids.website).toBe('https://elizabethwarren.com/'); // Kept
    expect(entity.ids.wikidata).toBe('Q434706');
    expect(entity.accounts.map((a) => a.handle)).toEqual([
      '@senwarren',
      'ewarren',
      'elizabeth-warren.bsky.social',
    ]);
    expect(entity.aliases.map((a) => a.name)).toEqual([
      'Sen. Warren',
      'Elizabeth Ann Warren',
    ]);
    expect(added).toEqual([
      'Wikidata ID',
      'Wikipedia article',
      '2 accounts',
      '1 other name',
      '1 candidacy',
    ]);
    expect(current.accounts).toHaveLength(1); // Original untouched
  });

  it('names a new entity from its Wikidata label, and the same names count once', () => {
    const { entity } = fillFromWikidata(
      {},
      wikidataSuggestions(COINBASE, 'organization'),
    );
    expect(entity.name).toBe('Coinbase');
    // "Coinbase Global, Inc." and "Coinbase Global" are one name to the duplicate check
    expect(entity.aliases.map((a) => a.name)).toEqual([
      'Coinbase Global, Inc.',
    ]);
  });
});
