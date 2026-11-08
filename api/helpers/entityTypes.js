// Entity constants shared by the Entity model (server) and the admin pages (browser), which can't
// import the model.
// project: something made or run, rather than the organization behind it: a product, website,
// app, protocol, token, publication or initiative (Web3 is Going Just Great, Bluesky, Bitcoin).
export const ENTITY_TYPES = [
  'person',
  'organization',
  'project',
  'committee',
  'bill',
  'case',
  'enforcement',
  'event',
];

export const ENTITY_STATUSES = [
  'active',
  'defunct',
  'merged',
  'acquired',
  'bankrupt',
];
export const ALIAS_KINDS = ['other', 'former'];
// agency: executive-branch bodies (the SEC, the Department of Commerce). legislative: the Senate,
// the House, their committees and state legislatures. Campaign committees are their own type.
export const ORGANIZATION_KINDS = [
  'company',
  'agency',
  'legislative',
  'court',
  'political party',
  'trade group',
  'nonprofit',
  'outlet',
  'other',
];
export const COMMITTEE_TYPES = [
  'super PAC',
  'PAC',
  'hybrid PAC',
  'leadership PAC',
  'party committee',
  'candidate committee',
];
export const OFFICES = ['house', 'senate', 'president'];
export const CHAMBERS = ['house', 'senate'];
export const OUTCOME_KINDS = ['penalty', 'settlement', 'dismissal'];

export const RELATION_KINDS = [
  'works_at',
  'member_of',
  'owns',
  'subsidiary_of',
  'part_of',
  'funds',
  'gave_to',
  'affiliated',
  'party_to',
  'sponsored',
  'companion',
  'referred_to',
  'parent_of',
  'spouse_of',
  'sibling_of',
  'relative_of',
];

// How a relation reads from its `from` side ("Paul Grewal works at Coinbase") and from its `to`
// side ("Coinbase employs Paul Grewal").
export const RELATION_LABELS = {
  works_at: { from: 'works at', to: 'employs' },
  // Sitting on a body, e.g. a congressional committee; the role is the seat ("Ranking Member")
  member_of: { from: 'member of', to: 'has member' },
  owns: { from: 'owns', to: 'owned by' },
  subsidiary_of: { from: 'subsidiary of', to: 'parent of' },
  // A body inside another that isn't a separate company: a committee in the Senate, an agency in
  // a department, a division in a company
  part_of: { from: 'part of', to: 'includes' },
  funds: { from: 'funds', to: 'funded by' },
  gave_to: { from: 'gave to', to: 'received from' },
  affiliated: { from: 'affiliated with', to: 'affiliated with' },
  party_to: { from: 'party to', to: 'party' },
  sponsored: { from: 'sponsored', to: 'sponsored by' },
  companion: { from: 'companion of', to: 'companion of' },
  referred_to: { from: 'referred to', to: 'referral from' },
  // Family. relative_of is any other relation (cousin, in-law…); say which in the role, which
  // shows on both pages, so word it to read both ways ("cousins", "in-laws").
  parent_of: { from: 'parent of', to: 'child of' },
  spouse_of: { from: 'spouse of', to: 'spouse of' },
  sibling_of: { from: 'sibling of', to: 'sibling of' },
  relative_of: { from: 'relative of', to: 'relative of' },
};

// The same, for a relation that has ended (it has an end date): "worked at", "employed". Kinds
// that already read as past ("gave to", "sponsored") or don't end aren't listed.
const PAST_RELATION_LABELS = {
  works_at: { from: 'worked at', to: 'employed' },
  member_of: { from: 'was member of', to: 'had member' },
  owns: { from: 'owned', to: 'was owned by' },
  subsidiary_of: { from: 'was subsidiary of', to: 'was parent of' },
  part_of: { from: 'was part of', to: 'included' },
  funds: { from: 'funded', to: 'was funded by' },
  affiliated: { from: 'was affiliated with', to: 'was affiliated with' },
  party_to: { from: 'was party to', to: 'former party' },
  companion: { from: 'was companion of', to: 'was companion of' },
  spouse_of: { from: 'former spouse of', to: 'former spouse of' },
};

/**
 * How a relation reads from one side, in the past tense once it has ended.
 * @param {{kind: string, direction: 'from'|'to', end?: string}} relation
 */
export function relationLabel({ kind, direction, end }) {
  const labels = (end && PAST_RELATION_LABELS[kind]) || RELATION_LABELS[kind];
  return labels?.[direction] || kind;
}
