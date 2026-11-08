import { accountKey, nameKey } from '../../backend/helpers/entityKeys.js';
import { fieldsFor } from './entityFields.js';
import { wikipediaArticleUrl } from './wikipedia.js';

// Filling in an entity from its Wikidata entry: accounts, website, Wikipedia article, other names
// and identifiers. Only fields left empty are filled (accounts and other names are added to); the
// description is never taken. The editor and the new-entity dialog show what was added before
// anything is saved. Fetching is in backend/helpers/wikidata.js.

// Accounts, by Wikidata property
const ACCOUNT_PROPERTIES = {
  P2002: 'twitter', // X (Twitter) username
  P4033: 'mastodon', // Mastodon address, user@server
  P12361: 'bluesky', // Bluesky handle
  P11892: 'threads', // Threads username
  P7085: 'tiktok', // TikTok username
  P2397: 'youtube', // YouTube channel ID
};
const OFFICIAL_WEBSITE = 'P856';
const SEC_CIK = 'P5531';
const OFFICIAL_NAME = 'P1448';
const FEC_ID = 'P1839'; // Candidates (S…, H…, P…), and committees (C…)
const FEC_COMMITTEE_ID = 'P7057';
const END_TIME = 'P582';

const QID = /^Q\d+$/;

/**
 * A Wikidata ID from an ID or a link to the entry ("https://www.wikidata.org/wiki/Q434706").
 * @param {string} text
 * @returns {?string}
 */
export function wikidataId(text) {
  const value = String(text || '').trim();
  if (QID.test(value.toUpperCase())) {
    return value.toUpperCase();
  }
  const match = /wikidata\.org\/(?:wiki|entity)\/(Q\d+)/i.exec(value);
  return match ? match[1].toUpperCase() : null;
}

// A claim's statements still in use: not deprecated, and not marked as ended (an account no longer
// used). Preferred statements alone when there are any.
function currentValues(entry, property) {
  const statements = (entry.claims?.[property] || []).filter(
    (s) =>
      s.rank !== 'deprecated' &&
      !s.qualifiers?.[END_TIME] &&
      s.mainsnak?.datavalue?.value !== undefined,
  );
  const preferred = statements.filter((s) => s.rank === 'preferred');
  return preferred.length ? preferred : statements;
}

const stringValues = (entry, property) =>
  currentValues(entry, property)
    .map((s) => s.mainsnak.datavalue.value)
    .map((v) => (typeof v === 'object' ? v.text : v))
    .filter((v) => typeof v === 'string' && v.trim())
    .map((v) => v.trim());

// "S2MA00170" -> a Senate candidacy in Massachusetts; House IDs carry the state too
function candidacyFromFecId(id) {
  const office = { S: 'senate', H: 'house', P: 'president' }[id[0]];
  if (!office) {
    return null;
  }
  return {
    fecCandidateId: id,
    office,
    ...(office !== 'president' ? { state: id.slice(2, 4) } : {}),
  };
}

/**
 * What a Wikidata entry offers an entity of this type, in the entity's own shape. Only fields the
 * type has; never the description.
 * @param {Object} entry One entity from Wikidata's EntityData JSON
 * @param {string} type The entity's type
 */
export function wikidataSuggestions(entry, type) {
  const has = new Set(fieldsFor(type).map((f) => f.name));
  const suggestions = { ids: { wikidata: entry.id } };

  const sitelink = Object.entries(entry.sitelinks || {}).find(
    ([site]) => site === 'enwiki',
  );
  if (sitelink && has.has('ids.wikipedia')) {
    suggestions.ids.wikipedia = wikipediaArticleUrl(sitelink[1].title);
  }
  if (has.has('accounts')) {
    // The official website first, as a website account
    const [website] = stringValues(entry, OFFICIAL_WEBSITE);
    suggestions.accounts = [
      ...(website ? [{ network: 'website', handle: website }] : []),
      ...Object.entries(ACCOUNT_PROPERTIES).flatMap(([property, network]) =>
        stringValues(entry, property).map((handle) => ({
          network,
          handle: handle.replace(/^@/, ''),
        })),
      ),
    ];
  }

  // The English label names a new entity; for one already named differently, it's another name
  suggestions.label = entry.labels?.en?.value;
  if (has.has('aliases')) {
    const names = [
      suggestions.label,
      ...stringValues(entry, OFFICIAL_NAME),
      ...(entry.aliases?.en || []).map((a) => a.value),
    ].filter(Boolean);
    suggestions.aliases = names.map((name) => ({ name, kind: 'other' }));
  }

  if (has.has('secCik')) {
    [suggestions.secCik] = stringValues(entry, SEC_CIK);
  }
  const fecIds = stringValues(entry, FEC_ID);
  if (has.has('fecId')) {
    suggestions.fecId =
      stringValues(entry, FEC_COMMITTEE_ID)[0] ||
      fecIds.find((id) => id.startsWith('C'));
  }
  if (has.has('candidacies')) {
    suggestions.candidacies = fecIds.map(candidacyFromFecId).filter(Boolean);
  }
  return suggestions;
}

const isEmpty = (value) =>
  value === undefined || value === null || String(value).trim() === '';

/**
 * Fill an entity's empty fields from Wikidata's suggestions. Accounts, other names and candidacies
 * not already there are added; nothing already filled in is changed.
 * @param {Object} entity The entity as the form has it now
 * @param {Object} suggestions From wikidataSuggestions
 * @returns {{entity: Object, added: string[]}} The filled-in entity, and what was added, for
 *   telling the user ("Bluesky account", "2 other names")
 */
export function fillFromWikidata(entity, suggestions) {
  const filled = { ...entity, ids: { ...(entity.ids || {}) } };
  const added = [];
  const counted = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  for (const [key, label] of [
    ['wikidata', 'Wikidata ID'],
    ['wikipedia', 'Wikipedia article'],
  ]) {
    const value = suggestions.ids?.[key];
    if (value && isEmpty(filled.ids[key])) {
      filled.ids[key] = value;
      added.push(label);
    }
  }
  for (const [key, label] of [
    ['secCik', 'SEC CIK'],
    ['fecId', 'FEC ID'],
  ]) {
    if (suggestions[key] && isEmpty(filled[key])) {
      filled[key] = suggestions[key];
      added.push(label);
    }
  }
  if (suggestions.label && isEmpty(filled.name)) {
    filled.name = suggestions.label;
    added.push('name');
  }

  if (suggestions.accounts?.length) {
    const have = new Set(
      (filled.accounts || []).map((a) => accountKey(a.network, a.handle)),
    );
    const newAccounts = suggestions.accounts.filter((a) => {
      const key = accountKey(a.network, a.handle);
      const fresh = !have.has(key);
      have.add(key);
      return fresh;
    });
    if (newAccounts.length) {
      filled.accounts = [...(filled.accounts || []), ...newAccounts];
      added.push(counted(newAccounts.length, 'account', 'accounts'));
    }
  }

  if (suggestions.aliases?.length) {
    const have = new Set(
      [filled.name, ...(filled.aliases || []).map((a) => a.name)]
        .filter(Boolean)
        .map(nameKey),
    );
    const newNames = suggestions.aliases.filter((alias) => {
      const key = nameKey(alias.name);
      const fresh = key && !have.has(key);
      have.add(key);
      return fresh;
    });
    if (newNames.length) {
      filled.aliases = [...(filled.aliases || []), ...newNames];
      added.push(counted(newNames.length, 'other name', 'other names'));
    }
  }

  if (suggestions.candidacies?.length) {
    const have = new Set(
      (filled.candidacies || []).map((c) => c.fecCandidateId).filter(Boolean),
    );
    const newRuns = suggestions.candidacies.filter(
      (c) => !have.has(c.fecCandidateId),
    );
    if (newRuns.length) {
      filled.candidacies = [...(filled.candidacies || []), ...newRuns];
      added.push(counted(newRuns.length, 'candidacy', 'candidacies'));
    }
  }

  return { entity: filled, added };
}
