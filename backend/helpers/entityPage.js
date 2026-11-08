import { DateTime } from 'luxon';
import {
  accountRows,
  elsewhereRows,
  formerNames,
  typeFacts,
} from '../../api/helpers/entityFacts.js';
import { relationLabel } from '../../api/helpers/entityTypes.js';
import { ENTITY_TYPE_NAMES, entityUrl } from '../../api/helpers/entityUrls.js';
import { Entity } from '../models/entity.model.js';
import { PressEntry, ShortformEntry } from '../models/entry.model.js';
import { FeedEntry } from '../models/feed/feedEntry.model.js';
import MicroEntry from '../models/micro/microEntry.model.js';
import { Tag } from '../models/tag.model.js';
import { Thread } from '../models/thread.model.js';
import { ENTITY_SUMMARY_FIELDS, relationsFor } from './entities.js';
import {
  FEED_ENTRY_LABEL_POPULATE,
  feedEntryHref,
  labelFeedEntry,
} from './feedEntries.js';
import { loadArchives } from './postContext.js';

// Everything an entity's page shows (/entities/<type>/<slug>): its entries, threads, relations,
// related entities and, by type, documents, versions and outlet reading. See pug/views/entities.

const ZONE = 'America/New_York';
const ENTRY_LIMIT = 20; // Entries shown before "show all"
const RELATED_LIMIT = 6;

// The kinds of entry, for the filter chips and each row's icon.
export const ENTRY_KINDS = [
  {
    value: 'posts',
    label: 'posts',
    icon: 'chat',
    match: (e) => e.__t === 'FeedEntryMicro',
  },
  {
    value: 'newsletter',
    label: 'newsletter',
    icon: 'envelope',
    match: (e) => e.__t === 'FeedEntryCitationNeeded',
  },
  {
    value: 'reading',
    label: 'reading',
    icon: 'newspaper',
    match: (e) => e.__t === 'FeedEntryReading',
  },
  {
    value: 'press',
    label: 'press',
    icon: 'quote',
    match: (e) => e.__t === 'FeedEntryPress',
  },
];

const idOf = (value) => String(value?._id ?? value);
const isLive = (entry) => !(entry.__t === 'FeedEntryMicro' && !entry.micro);
const dt = (date) => DateTime.fromJSDate(new Date(date), { zone: ZONE });

/**
 * An entry as a row: "Oct 30  [icon]  label", grouped under its year. Newsletter issues and
 * articles are titles, so they're in italics.
 * @param {Object} entry Populated with FEED_ENTRY_LABEL_POPULATE
 */
export function entryRow(entry) {
  const kind = ENTRY_KINDS.find((k) => k.match(entry)) || ENTRY_KINDS[0];
  const date = dt(entry.createdAt);
  return {
    id: idOf(entry),
    kind: kind.value,
    icon: kind.icon,
    year: date.year,
    date: date.toFormat('LLL d'),
    iso: new Date(entry.createdAt).toISOString(),
    label: labelFeedEntry(entry).label,
    href: feedEntryHref(entry),
    italic: ['newsletter', 'reading'].includes(kind.value),
  };
}

/**
 * Rows grouped by year, newest first.
 * @param {Object[]} rows
 */
export function byYear(rows) {
  const years = [];
  for (const row of rows) {
    const last = years[years.length - 1];
    if (last?.year === row.year) {
      last.rows.push(row);
    } else {
      years.push({ year: row.year, rows: [row] });
    }
  }
  return years;
}

// "since 2024 · latest Oct 30, 2026"
function glance(entries) {
  if (!entries.length) {
    return { count: 0 };
  }
  const newest = dt(entries[0].createdAt);
  const oldest = dt(entries[entries.length - 1].createdAt);
  return {
    count: entries.length,
    since: oldest.year,
    latest: newest.toFormat(
      newest.year === DateTime.now().year ? 'LLL d' : 'LLL d, yyyy',
    ),
  };
}

// Titled threads containing any of these entries: "Coinbase FEC complaint · 4 entries · Jul 2024 →
// Oct 2026".
async function threadsFor(entries) {
  const threadIds = [
    ...new Map(
      entries.flatMap((e) => e.threads || []).map((t) => [idOf(t), t]),
    ).values(),
  ];
  if (!threadIds.length) {
    return [];
  }
  const [threads, spans] = await Promise.all([
    Thread.find(
      { _id: { $in: threadIds }, title: { $nin: [null, ''] } },
      'title slug',
    ).lean(),
    FeedEntry.aggregate([
      { $match: { threads: { $in: threadIds }, deletedAt: null } },
      { $unwind: '$threads' },
      { $match: { threads: { $in: threadIds } } },
      {
        $group: {
          _id: '$threads',
          count: { $sum: 1 },
          first: { $min: '$createdAt' },
          last: { $max: '$createdAt' },
        },
      },
    ]),
  ]);
  const spanOf = new Map(spans.map((s) => [idOf(s._id), s]));
  return threads
    .map((thread) => {
      const span = spanOf.get(idOf(thread));
      return {
        title: thread.title,
        href: `/feed/thread/${thread.slug}`,
        count: span?.count || 0,
        from: span ? dt(span.first).toFormat('LLL yyyy') : null,
        to: span ? dt(span.last).toFormat('LLL yyyy') : null,
        last: span?.last || 0,
      };
    })
    .sort((a, b) => b.last - a.last);
}

// Entities that share the most entries with this one, with how many: "Paul Grewal [3]". Only
// entities with a page are listed.
async function sharedEntities(entity, entries) {
  const counts = new Map();
  for (const entry of entries) {
    for (const id of (entry.about || []).map(idOf)) {
      if (id !== idOf(entity)) {
        counts.set(id, (counts.get(id) || 0) + 1);
      }
    }
  }
  if (!counts.size) {
    return [];
  }
  const others = await Entity.find(
    { _id: { $in: [...counts.keys()] }, hasPage: true },
    ENTITY_SUMMARY_FIELDS,
  ).lean();
  return others
    .map((other) => ({ entity: other, count: counts.get(idOf(other)) }))
    .sort(
      (a, b) => b.count - a.count || a.entity.name.localeCompare(b.entity.name),
    );
}

// What the other entity is, from this page's side, when a relation has no role of its own:
// a bill's "sponsor", a committee's "affiliate". Kinds not listed use their admin wording.
export const RELATION_NOUNS = {
  sponsored: { from: 'sponsored', to: 'sponsor' },
  affiliated: { from: 'affiliate', to: 'affiliate' },
  companion: { from: 'companion', to: 'companion' },
  referred_to: { from: 'referred to', to: 'referral' },
  works_at: { from: 'employer', to: 'employee' },
  member_of: { from: 'member of', to: 'member' },
  subsidiary_of: { from: 'parent', to: 'subsidiary' },
  part_of: { from: 'part of', to: 'part' },
  owns: { from: 'owned', to: 'owner' },
  funds: { from: 'funded', to: 'funder' },
  gave_to: { from: 'recipient', to: 'donor' },
  parent_of: { from: 'child', to: 'parent' },
  spouse_of: { from: 'spouse', to: 'spouse' },
  sibling_of: { from: 'sibling', to: 'sibling' },
  relative_of: { from: 'relative', to: 'relative' },
};

// A member with a seat of their own (Chair, Ranking Member), not just "member"
const hasSeat = (row) => Number(row.label !== RELATION_NOUNS.member_of.to);

/**
 * A body's current members (e.g. a committee's), those with a seat first, then by name.
 * @param {Object[]} rows The entity's relations, as relationRow makes them
 */
export const currentMembers = (rows) =>
  rows
    .filter((r) => r.kind === 'member_of' && r.direction === 'to' && r.current)
    .sort((a, b) => hasSeat(b) - hasSeat(a) || a.name.localeCompare(b.name));

// Relations as rows: the other entity, linked when it has a page, and the label.
function relationRow(relation) {
  const other = relation.other;
  return {
    id: idOf(relation),
    kind: relation.kind,
    direction: relation.direction,
    name: other.name,
    href: entityUrl(other),
    entity: other,
    label:
      relation.role ||
      RELATION_NOUNS[relation.kind]?.[relation.direction] ||
      relationLabel(relation),
    current: !relation.end,
  };
}

// A case's documents in your posts: document blocks that name the case.
async function documentsFor(entity) {
  const posts = await MicroEntry.find(
    {
      deletedAt: null,
      'post.blocks': {
        $elemMatch: { type: 'document', 'data.entity._id': idOf(entity) },
      },
    },
    'slug createdAt post',
  )
    .sort({ createdAt: -1 })
    .lean();
  return posts.flatMap((post) =>
    post.post.blocks
      .filter(
        (block) =>
          block.type === 'document' &&
          idOf(block.data?.entity?._id) === idOf(entity),
      )
      .map((block) => {
        const date = block.data.date
          ? DateTime.fromISO(block.data.date)
          : dt(post.createdAt);
        return {
          date: date.toFormat('LLL d, yyyy'),
          title: block.data.title || 'Document',
          href: `/micro/entry/${post.slug}`,
        };
      }),
  );
}

// An outlet's reading and press, newest first.
async function outletItems(entity) {
  const [reading, press] = await Promise.all([
    ShortformEntry.find({ outlet: entity._id }, 'title href date')
      .sort({ date: -1 })
      .limit(20)
      .lean(),
    PressEntry.find({ outlet: entity._id }, 'title href date')
      .sort({ date: -1 })
      .limit(20)
      .lean(),
  ]);
  return [
    ...reading.map((r) => ({ ...r, kind: 'reading', icon: 'newspaper' })),
    ...press.map((p) => ({ ...p, kind: 'press', icon: 'quote' })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

/**
 * The page for an entity, or null when there's no such entity with a page.
 * @param {string} type
 * @param {string} slug
 * @param {{filter?: string, all?: boolean}} [options] filter: a chip's value; all: every entry
 */
export async function loadEntityPage(type, slug, { filter, all = false } = {}) {
  const entity = await Entity.findOne({ type, slug, hasPage: true }).lean();
  if (!entity) {
    return null;
  }
  const [entries, relations, tag] = await Promise.all([
    FeedEntry.find(entityEntriesQuery(entity))
      .sort({ createdAt: -1 })
      .populate(FEED_ENTRY_LABEL_POPULATE)
      .lean()
      .then((list) => list.filter(isLive)),
    // Sponsors show their party and state, from their candidacies.
    relationsFor(entity._id, {
      fields: `${ENTITY_SUMMARY_FIELDS} candidacies`,
    }),
    entity.tag ? Tag.findById(entity.tag, 'value text').lean() : null,
  ]);
  const [threads, shared, documents, outlet, archived] = await Promise.all([
    threadsFor(entries),
    sharedEntities(entity, entries),
    type === 'case' ? documentsFor(entity) : [],
    entity.domains?.length ? outletItems(entity) : [],
    loadArchives([entity.complaint?.pdfUrl].filter(Boolean)),
  ]);

  const rows = entries.map(entryRow);
  const kinds = ENTRY_KINDS.map((kind) => ({
    ...kind,
    count: rows.filter((row) => row.kind === kind.value).length,
  })).filter((kind) => kind.count);
  const activeFilter = kinds.some((k) => k.value === filter) ? filter : null;
  const filtered = activeFilter
    ? rows.filter((row) => row.kind === activeFilter)
    : rows;
  const shown = all ? filtered : filtered.slice(0, ENTRY_LIMIT);

  const relationRows = relations.map(relationRow);
  const ofKind = (kind) => relationRows.filter((r) => r.kind === kind);
  // Labelled relations first, then entities sharing entries, without repeats.
  const related = [
    ...relationRows.filter((r) => r.href),
    ...shared
      .filter(
        (s) => !relationRows.some((r) => idOf(r.entity) === idOf(s.entity)),
      )
      .map((s) => ({
        name: s.entity.name,
        href: entityUrl(s.entity),
        count: s.count,
      })),
  ].slice(0, RELATED_LIMIT);

  return {
    entity,
    typeName: ENTITY_TYPE_NAMES[entity.type],
    tag,
    // From the entity's own fields (api/helpers/entityFacts.js)
    accounts: accountRows(entity),
    elsewhere: elsewhereRows(entity),
    facts: typeFacts(entity),
    formerly: formerNames(entity),
    glance: glance(entries),
    // Person: the current job, the relation with no end
    role: relationRows.find(
      (r) => r.kind === 'works_at' && r.direction === 'from' && r.current,
    ),
    threads,
    kinds,
    activeFilter,
    entryCount: filtered.length,
    years: byYear(shown),
    hasMore: shown.length < filtered.length,
    parties: ofKind('party_to').filter((r) => r.direction === 'to'),
    sponsors: ofKind('sponsored').filter((r) => r.direction === 'to'),
    // A body's current members, those with a seat (Chair, Ranking Member) first
    members: currentMembers(relationRows),
    affiliated: ofKind('affiliated'),
    related,
    documents,
    outlet,
    complaintArchive: entity.complaint?.pdfUrl
      ? archived[entity.complaint.pdfUrl]
      : null,
  };
}

/**
 * The feed entries an entity's page lists: those marked as about it, and those with its tag (so
 * posts tagged before entities existed show up without being marked again).
 * @param {{_id: *, tag?: *}} entity
 */
export function entityEntriesQuery(entity) {
  return {
    deletedAt: null,
    $or: [{ about: entity._id }, ...(entity.tag ? [{ tags: entity.tag }] : [])],
  };
}

/**
 * How many entries each entity has, counting an entry once even when it's both about the entity
 * and has its tag.
 * @param {{_id: *, tag?: *}[]} entities
 * @param {{about?: *[], tags?: *[]}[]} entries
 * @returns {Map<string, number>} By entity id
 */
export function countEntityEntries(entities, entries) {
  const byTag = new Map();
  for (const entity of entities) {
    if (entity.tag) {
      byTag.set(idOf(entity.tag), [
        ...(byTag.get(idOf(entity.tag)) || []),
        idOf(entity),
      ]);
    }
  }
  const counts = new Map();
  for (const entry of entries) {
    const ids = new Set([
      ...(entry.about || []).map(idOf),
      ...(entry.tags || []).flatMap((tag) => byTag.get(idOf(tag)) || []),
    ]);
    for (const id of ids) {
      counts.set(id, (counts.get(id) || 0) + 1);
    }
  }
  return counts;
}

/**
 * Entities with pages, by type, with how many entries each has, for the index pages.
 * @param {string} [type] Just this type
 */
export async function loadEntityIndex(type) {
  const entities = await Entity.find(
    { hasPage: true, ...(type ? { type } : {}) },
    'name slug type hasPage description disambiguator tag',
  )
    .sort({ name: 1 })
    .lean();
  const tags = entities.map((e) => e.tag).filter(Boolean);
  const entries = await FeedEntry.find(
    {
      deletedAt: null,
      $or: [
        { about: { $in: entities.map((e) => e._id) } },
        ...(tags.length ? [{ tags: { $in: tags } }] : []),
      ],
    },
    'about tags',
  ).lean();
  const counts = countEntityEntries(entities, entries);
  return entities.map((entity) => ({
    ...entity,
    href: entityUrl(entity),
    count: counts.get(idOf(entity)) || 0,
  }));
}
