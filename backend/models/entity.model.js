import mongoose from 'mongoose';
import {
  ALIAS_KINDS,
  CHAMBERS,
  COMMITTEE_TYPES,
  ENTITY_STATUSES,
  ENTITY_TYPES,
  OFFICES,
  ORGANIZATION_KINDS,
  OUTCOME_KINDS,
  RELATION_KINDS,
} from '../../api/helpers/entityTypes.js';
import { easternDate } from '../../api/helpers/easternDate.js';
import { normalizePartialDate } from '../../api/helpers/partialDate.js';
import {
  MENTION_NETWORKS,
  cleanHandle,
} from '../../api/helpers/socialMedia.js';
import { wikidataId } from '../../api/helpers/wikidata.js';
import { wikipediaArticleUrl } from '../../api/helpers/wikipedia.js';
import {
  accountKey,
  nameKey,
  normalizeDomain,
  slugify,
} from '../helpers/entityKeys.js';
import db from './db.js';

const { ObjectId } = mongoose.Schema.Types;

// Dates typed without a time are days in Eastern time (api/helpers/easternDate.js).
const Day = { type: Date, set: easternDate };
// A year, month or day, as precisely as it's known: "2019", "2019-03" or "2019-03-05"
const PartialDay = {
  type: String,
  set: (value) =>
    value === '' || value == null ? undefined : String(value).trim(),
  validate: {
    validator: (value) => value == null || normalizePartialDate(value) !== null,
    message: (props) =>
      `“${props.value}” isn’t a date: use a year, YYYY-MM or YYYY-MM-DD.`,
  },
};

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Unique only among documents that have the field, so entities without it don't collide.
const uniqueWhenSet = (path) => [
  { [path]: 1 },
  { unique: true, partialFilterExpression: { [path]: { $type: 'string' } } },
];

export const EntitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, match: slugPattern },
    disambiguator: { type: String, trim: true },
    aliases: [
      {
        _id: false,
        name: { type: String, required: true, trim: true },
        kind: { type: String, enum: ALIAS_KINDS, default: 'other' },
        until: Day,
      },
    ],
    description: String,
    note: String,
    status: {
      value: { type: String, enum: ENTITY_STATUSES },
      date: Day,
    },
    tag: { type: ObjectId, ref: 'Tag' },
    ids: {
      wikidata: { type: String, match: /^Q\d+$/ },
      website: String,
      // The Wikipedia article about them, as a link (wikipedia.js). Not one of their accounts.
      wikipedia: String,
    },
    accounts: [
      {
        _id: false,
        // Social networks plus website (URL)
        network: { type: String, enum: MENTION_NETWORKS, required: true },
        handle: { type: String, required: true, trim: true },
      },
    ],
    elsewhere: [
      {
        _id: false,
        label: { type: String, required: true },
        url: { type: String, required: true, match: /^https?:\/\// },
      },
    ],
    citations: [
      {
        _id: false,
        field: { type: String, required: true },
        url: { type: String, required: true, match: /^https?:\/\// },
        retrievedAt: Day,
      },
    ],
    // People get no page by default: most are mention-only. Set in pre('validate') when unset.
    hasPage: Boolean,
    // Derived on save; never set by hand.
    nameKeys: { type: [String], index: true },
    accountKeys: [String],
  },
  { timestamps: true, discriminatorKey: 'type' },
);

EntitySchema.index({ type: 1, slug: 1 }, { unique: true });
EntitySchema.index(...uniqueWhenSet('ids.wikidata'));
EntitySchema.index(...uniqueWhenSet('ids.wikipedia'));
EntitySchema.index(...uniqueWhenSet('accountKeys'));
// Type-specific identifiers, declared here so the indexes cover the whole collection.
EntitySchema.index(...uniqueWhenSet('secCik'));
EntitySchema.index(...uniqueWhenSet('domains'));
EntitySchema.index(...uniqueWhenSet('fecId'));

EntitySchema.pre('validate', function () {
  if (this.hasPage === undefined || this.hasPage === null) {
    this.hasPage = this.type !== 'person';
  }
  if (!this.slug && this.name) {
    this.slug = slugify(
      this.disambiguator ? `${this.name} ${this.disambiguator}` : this.name,
    );
  }
  this.nameKeys = [
    ...new Set(
      [this.name, ...this.aliases.map((alias) => alias.name)]
        .filter(Boolean)
        .map(nameKey),
    ),
  ];
  // A pasted link to the Wikidata entry is stored as its ID
  if (this.ids?.wikidata) {
    this.ids.wikidata = wikidataId(this.ids.wikidata) || this.ids.wikidata;
  }
  // A link or title in any form is stored as the article's link, so the same article always matches
  if (this.ids?.wikipedia) {
    const article = wikipediaArticleUrl(this.ids.wikipedia);
    if (article) {
      this.ids.wikipedia = article;
    } else {
      this.invalidate(
        'ids.wikipedia',
        'That isn’t a link to a Wikipedia article.',
      );
    }
  }
  for (const account of this.accounts) {
    account.handle = cleanHandle(account.network, account.handle);
  }
  this.accountKeys = this.accounts.map(({ network, handle }) =>
    accountKey(network, handle),
  );
  if (this.domains) {
    this.domains = [...new Set(this.domains.map(normalizeDomain))];
  }
});

export const Entity = db.connection.model('Entity', EntitySchema, 'entities');

export const PersonEntity = Entity.discriminator(
  'person',
  new mongoose.Schema({
    candidacies: [
      {
        _id: false,
        fecCandidateId: String,
        office: { type: String, enum: OFFICES },
        state: String,
        district: String,
        party: String,
        years: [Number],
      },
    ],
  }),
);

export const OrganizationEntity = Entity.discriminator(
  'organization',
  new mongoose.Schema({
    kind: { type: String, enum: ORGANIZATION_KINDS, default: 'company' },
    secCik: { type: String, match: /^\d{1,10}$/ },
    // Outlets: articles from these domains get this outlet, and its paywall default.
    domains: [String],
    paywalledByDefault: Boolean,
  }),
);

export const ProjectEntity = Entity.discriminator(
  'project',
  new mongoose.Schema({
    launchedAt: Day,
  }),
);

export const CommitteeEntity = Entity.discriminator(
  'committee',
  new mongoose.Schema({
    fecId: { type: String, match: /^C\d{8}$/ },
    committeeType: { type: String, enum: COMMITTEE_TYPES },
  }),
);

export const BillEntity = Entity.discriminator(
  'bill',
  new mongoose.Schema({
    number: String, // e.g. "H.R. 3633"
    congress: Number,
    chamber: { type: String, enum: CHAMBERS },
    billStatus: String,
    congressGovUrl: String,
    versions: [
      {
        _id: false,
        label: { type: String, required: true }, // e.g. "Introduced"
        date: Day,
        textUrl: String,
      },
    ],
  }),
);

export const CaseEntity = Entity.discriminator(
  'case',
  new mongoose.Schema({
    court: String,
    docketNumber: String,
    judge: String,
    filedAt: Day,
    caseStatus: String,
    courtListenerUrl: String,
    pacerUrl: String,
    complaint: { pdfUrl: String },
  }),
);

export const EnforcementEntity = Entity.discriminator(
  'enforcement',
  new mongoose.Schema({
    releaseNumber: String,
    date: Day,
    outcome: {
      kind: { type: String, enum: OUTCOME_KINDS },
      amountUsd: Number,
    },
  }),
);

export const EventEntity = Entity.discriminator(
  'event',
  new mongoose.Schema({
    startDate: PartialDay,
    endDate: PartialDay,
    amounts: [
      {
        _id: false,
        label: { type: String, required: true },
        amountUsd: { type: Number, required: true },
      },
    ],
  }),
);

export { ENTITY_TYPES, RELATION_KINDS };

// Dated, typed links between entities. Roles, parties, sponsors and affiliations are all
// relations, so each fact is stored once and shows on both entities' pages.
export const EntityRelationSchema = new mongoose.Schema(
  {
    from: { type: ObjectId, ref: 'Entity', required: true, index: true },
    to: { type: ObjectId, ref: 'Entity', required: true, index: true },
    kind: { type: String, enum: RELATION_KINDS, required: true },
    role: String, // e.g. "Chief Legal Officer", "plaintiff"
    start: PartialDay,
    end: PartialDay, // The current role is the one with no end
    amountUsd: Number,
    source: { type: String, match: /^https?:\/\// },
  },
  { timestamps: true },
);

EntityRelationSchema.pre('validate', function () {
  if (this.from && this.to && this.from.equals(this.to)) {
    this.invalidate('to', 'An entity cannot be related to itself.');
  }
});

export const EntityRelation = db.connection.model(
  'EntityRelation',
  EntityRelationSchema,
  'entityRelations',
);
