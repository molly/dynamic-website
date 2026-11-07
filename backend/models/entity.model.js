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
import { MENTION_NETWORKS } from '../../api/helpers/socialMedia.js';
import {
  accountKey,
  nameKey,
  normalizeDomain,
  slugify,
} from '../helpers/entityKeys.js';
import db from './db.js';

const { ObjectId } = mongoose.Schema.Types;

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
        until: Date,
      },
    ],
    description: String,
    note: String,
    status: {
      value: { type: String, enum: ENTITY_STATUSES },
      date: Date,
    },
    tag: { type: ObjectId, ref: 'Tag' },
    ids: {
      wikidata: { type: String, match: /^Q\d+$/ },
      website: String,
    },
    accounts: [
      {
        _id: false,
        // Social networks plus wikipedia (article title) and website (URL)
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
        retrievedAt: Date,
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
    ticker: String,
    // Outlets: articles from these domains get this outlet, and its paywall default.
    domains: [String],
    paywalledByDefault: Boolean,
  }),
);

export const ProjectEntity = Entity.discriminator(
  'project',
  new mongoose.Schema({
    ticker: String,
    chains: [String],
    contracts: [
      {
        _id: false,
        chain: { type: String, required: true },
        address: { type: String, required: true },
      },
    ],
    coingeckoId: String,
    cmcId: String,
    launchedAt: Date,
  }),
);

export const CommitteeEntity = Entity.discriminator(
  'committee',
  new mongoose.Schema({
    fecId: { type: String, match: /^C\d{8}$/ },
    committeeType: { type: String, enum: COMMITTEE_TYPES },
    treasurer: String,
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
        date: Date,
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
    filedAt: Date,
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
    date: Date,
    outcome: {
      kind: { type: String, enum: OUTCOME_KINDS },
      amountUsd: Number,
    },
  }),
);

export const EventEntity = Entity.discriminator(
  'event',
  new mongoose.Schema({
    startDate: Date,
    endDate: Date,
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
    start: Date,
    end: Date, // The current role is the one with no end
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
