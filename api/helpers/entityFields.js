// The entity admin form, one field list per type. The browser renders the form from these, and the
// server uses them to know which fields an update may set. Adding a field to an entity type means
// adding it to the model and one line here.
//
// Field: { name, label, input, options?, placeholder?, help?, fields? }
// - name: dotted path into the entity ("status.value")
// - input: text | textarea | url | date | number | checkbox | select | tag | strings | list
//   - strings: a list of plain strings (one input each)
//   - list: a list of objects, each row rendered from `fields`
import {
  ALIAS_KINDS,
  CHAMBERS,
  COMMITTEE_TYPES,
  ENTITY_STATUSES,
  OFFICES,
  ORGANIZATION_KINDS,
  OUTCOME_KINDS,
} from './entityTypes.js';
import { MENTION_NETWORKS } from './socialMedia.js';

export const SHARED_FIELDS = [
  { name: 'name', label: 'Name', input: 'text' },
  {
    name: 'disambiguator',
    label: 'Disambiguator',
    input: 'text',
    help: 'Only needed when another entity has the same name.',
  },
  { name: 'description', label: 'One-line description', input: 'text' },
  {
    name: 'note',
    label: 'Note',
    input: 'textarea',
    help: 'Optional, in your words: why you cover this.',
  },
  { name: 'hasPage', label: 'Has a page', input: 'checkbox' },
  {
    name: 'status.value',
    label: 'Status',
    input: 'select',
    options: ENTITY_STATUSES,
  },
  { name: 'status.date', label: 'Status date', input: 'date' },
  { name: 'tag', label: 'Tag', input: 'tag' },
  {
    name: 'ids.wikidata',
    label: 'Wikidata ID',
    input: 'text',
    placeholder: 'Q12345',
  },
  { name: 'ids.website', label: 'Website', input: 'url' },
  {
    name: 'aliases',
    label: 'Other names',
    input: 'list',
    fields: [
      { name: 'name', label: 'Name', input: 'text' },
      { name: 'kind', label: 'Kind', input: 'select', options: ALIAS_KINDS },
      { name: 'until', label: 'Until', input: 'date' },
    ],
  },
  {
    name: 'accounts',
    label: 'Accounts',
    input: 'list',
    fields: [
      {
        name: 'network',
        label: 'Network',
        input: 'select',
        options: MENTION_NETWORKS,
      },
      { name: 'handle', label: 'Handle', input: 'text' },
    ],
  },
  {
    name: 'elsewhere',
    label: 'Elsewhere',
    input: 'list',
    fields: [
      { name: 'label', label: 'Label', input: 'text' },
      { name: 'url', label: 'URL', input: 'url' },
    ],
  },
  {
    name: 'citations',
    label: 'Sources for facts',
    input: 'list',
    fields: [
      {
        name: 'field',
        label: 'Field',
        input: 'text',
        placeholder: 'e.g. secCik',
      },
      { name: 'url', label: 'URL', input: 'url' },
      { name: 'retrievedAt', label: 'Retrieved', input: 'date' },
    ],
  },
];

export const TYPE_FIELDS = {
  person: [
    {
      name: 'candidacies',
      label: 'Candidacies',
      input: 'list',
      fields: [
        { name: 'fecCandidateId', label: 'FEC candidate ID', input: 'text' },
        { name: 'office', label: 'Office', input: 'select', options: OFFICES },
        { name: 'state', label: 'State', input: 'text' },
        { name: 'district', label: 'District', input: 'text' },
        { name: 'party', label: 'Party', input: 'text' },
      ],
    },
  ],
  organization: [
    {
      name: 'kind',
      label: 'Kind',
      input: 'select',
      options: ORGANIZATION_KINDS,
    },
    { name: 'secCik', label: 'SEC CIK', input: 'text' },
    { name: 'ticker', label: 'Ticker', input: 'text' },
    {
      name: 'domains',
      label: 'Domains',
      input: 'strings',
      help: 'Outlets: articles from these domains are matched to this outlet.',
    },
    {
      name: 'paywalledByDefault',
      label: 'Usually paywalled',
      input: 'checkbox',
    },
  ],
  project: [
    { name: 'ticker', label: 'Ticker', input: 'text' },
    { name: 'chains', label: 'Chains', input: 'strings' },
    {
      name: 'contracts',
      label: 'Contracts',
      input: 'list',
      fields: [
        { name: 'chain', label: 'Chain', input: 'text' },
        { name: 'address', label: 'Address', input: 'text' },
      ],
    },
    { name: 'coingeckoId', label: 'CoinGecko ID', input: 'text' },
    { name: 'cmcId', label: 'CoinMarketCap ID', input: 'text' },
    { name: 'launchedAt', label: 'Launched', input: 'date' },
  ],
  committee: [
    {
      name: 'fecId',
      label: 'FEC committee ID',
      input: 'text',
      placeholder: 'C00000000',
    },
    {
      name: 'committeeType',
      label: 'Committee type',
      input: 'select',
      options: COMMITTEE_TYPES,
    },
    { name: 'treasurer', label: 'Treasurer', input: 'text' },
  ],
  bill: [
    {
      name: 'number',
      label: 'Number',
      input: 'text',
      placeholder: 'H.R. 3633',
    },
    { name: 'congress', label: 'Congress', input: 'number' },
    { name: 'chamber', label: 'Chamber', input: 'select', options: CHAMBERS },
    { name: 'billStatus', label: 'Status', input: 'text' },
    { name: 'congressGovUrl', label: 'congress.gov URL', input: 'url' },
    {
      name: 'versions',
      label: 'Versions',
      input: 'list',
      fields: [
        { name: 'label', label: 'Label', input: 'text' },
        { name: 'date', label: 'Date', input: 'date' },
        { name: 'textUrl', label: 'Text URL', input: 'url' },
      ],
    },
  ],
  case: [
    { name: 'court', label: 'Court', input: 'text' },
    { name: 'docketNumber', label: 'Docket number', input: 'text' },
    { name: 'judge', label: 'Judge', input: 'text' },
    { name: 'filedAt', label: 'Filed', input: 'date' },
    { name: 'caseStatus', label: 'Status', input: 'text' },
    { name: 'courtListenerUrl', label: 'CourtListener URL', input: 'url' },
    { name: 'pacerUrl', label: 'PACER URL', input: 'url' },
    { name: 'complaint.pdfUrl', label: 'Complaint PDF', input: 'url' },
  ],
  enforcement: [
    { name: 'releaseNumber', label: 'Release number', input: 'text' },
    { name: 'date', label: 'Date', input: 'date' },
    {
      name: 'outcome.kind',
      label: 'Outcome',
      input: 'select',
      options: OUTCOME_KINDS,
    },
    { name: 'outcome.amountUsd', label: 'Amount (USD)', input: 'number' },
  ],
  event: [
    { name: 'startDate', label: 'Start date', input: 'date' },
    { name: 'endDate', label: 'End date', input: 'date' },
    {
      name: 'amounts',
      label: 'Amounts',
      input: 'list',
      fields: [
        { name: 'label', label: 'Label', input: 'text' },
        { name: 'amountUsd', label: 'Amount (USD)', input: 'number' },
      ],
    },
  ],
};

/**
 * Every field on the form for an entity type.
 * @param {string} type
 */
export function fieldsFor(type) {
  return [...SHARED_FIELDS, ...(TYPE_FIELDS[type] || [])];
}

/**
 * Top-level entity paths the form controls for a type ("status.value" -> "status"). An update
 * sets each of these from the request, so a field cleared on the form is cleared in the database.
 * @param {string} type
 */
export function editablePaths(type) {
  return [...new Set(fieldsFor(type).map((field) => field.name.split('.')[0]))];
}
