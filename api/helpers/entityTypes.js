// Entity constants shared by the Entity model (server) and the admin pages (browser), which can't
// import the model.
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
export const ORGANIZATION_KINDS = [
  'company',
  'agency',
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
  'owns',
  'subsidiary_of',
  'funds',
  'gave_to',
  'affiliated',
  'party_to',
  'sponsored',
  'companion',
  'referred_to',
];

// How a relation reads from its `from` side ("Paul Grewal works at Coinbase") and from its `to`
// side ("Coinbase employs Paul Grewal").
export const RELATION_LABELS = {
  works_at: { from: 'works at', to: 'employs' },
  owns: { from: 'owns', to: 'owned by' },
  subsidiary_of: { from: 'subsidiary of', to: 'parent of' },
  funds: { from: 'funds', to: 'funded by' },
  gave_to: { from: 'gave to', to: 'received from' },
  affiliated: { from: 'affiliated with', to: 'affiliated with' },
  party_to: { from: 'party to', to: 'party' },
  sponsored: { from: 'sponsored', to: 'sponsored by' },
  companion: { from: 'companion of', to: 'companion of' },
  referred_to: { from: 'referred to', to: 'referral from' },
};
