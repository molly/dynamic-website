import { fieldsFor } from '../../api/helpers/entityFields.js';
import { ENTITY_TYPES } from '../../api/helpers/entityTypes.js';
import { wikipediaArticleUrl } from '../../api/helpers/wikipedia.js';
import { Entity, EntityRelation } from '../models/entity.model.js';
import { accountKey, nameKey, normalizeDomain } from './entityKeys.js';

// Fields returned wherever an entity is shown as a choice (pickers, "Did you mean...?").
export const ENTITY_SUMMARY_FIELDS =
  'name slug type disambiguator hasPage accounts';

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Model for an entity type, so documents get that type's fields and validation.
 * @param {string} type
 * @returns {import('mongoose').Model|undefined}
 */
export function entityModelFor(type) {
  return Entity.discriminators?.[type];
}

// Fields that don't count as filled in: the name and type every entity has, and whether it has
// a page. An organization's kind counts only if it isn't the model's default.
const ALWAYS_SET = new Set(['name', 'hasPage']);
const DEFAULTS = { kind: 'company' };

// What "nothing filled in" looks like for each kind of form field. A missing field matches null.
function emptyValues(field) {
  switch (field.input) {
    case 'list':
    case 'strings':
      return [null, []];
    case 'checkbox':
      return [null, false];
    case 'date':
    case 'number':
    case 'tag':
      return [null];
    default:
      return [
        null,
        '',
        ...(field.name in DEFAULTS ? [DEFAULTS[field.name]] : []),
      ];
  }
}

/**
 * A query for entities with nothing filled in on the editor form but their name: no description,
 * accounts, IDs, other names or any of their type's fields. Relations aren't fields, so they
 * don't count.
 */
export function bareEntitiesQuery() {
  const fields = new Map();
  for (const type of ENTITY_TYPES) {
    for (const field of fieldsFor(type)) {
      if (!ALWAYS_SET.has(field.name)) {
        fields.set(field.name, field);
      }
    }
  }
  return {
    $and: [...fields.values()].map((field) => ({
      [field.name]: { $in: emptyValues(field) },
    })),
  };
}

/**
 * Search names, aliases and handles. Words match from their start, so "grew" finds "Paul Grewal".
 * With no query, returns the most recently updated entities.
 * @param {string} query
 * @param {{limit?: number, skip?: number, type?: string, bare?: boolean, newestFirst?: boolean}}
 *   options bare: only entities with nothing filled in but their name (bareEntitiesQuery).
 *   newestFirst: in the order they were created, newest first, with their creation dates (the
 *   admin list); otherwise matches are by name
 */
export function searchEntities(
  query,
  { limit = 20, skip = 0, type, bare = false, newestFirst = false } = {},
) {
  const fields = newestFirst
    ? `${ENTITY_SUMMARY_FIELDS} createdAt`
    : ENTITY_SUMMARY_FIELDS;
  const newest = { createdAt: -1, _id: -1 };
  const typeFilter = {
    ...(type ? { type } : {}),
    ...(bare ? bareEntitiesQuery() : {}),
  };
  const key = nameKey(query || '');
  if (!key) {
    return Entity.find(typeFilter, fields)
      .sort(newestFirst ? newest : { updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
  }
  const handle = query.trim().replace(/^@/, '').toLowerCase();
  return Entity.find(
    {
      ...typeFilter,
      $or: [
        // Every word typed must start some word of the name, in any order: "grewal paul" and
        // "pa gre" both find "Paul Grewal".
        {
          nameKeys: {
            $regex: `^${key
              .split(' ')
              .map((word) => `(?=.*(?:^| )${escapeRegex(word)})`)
              .join('')}`,
          },
        },
        { accountKeys: { $regex: `:${escapeRegex(handle)}` } },
      ],
    },
    fields,
  )
    .sort(newestFirst ? newest : { name: 1 })
    .skip(skip)
    .limit(limit)
    .lean();
}

/**
 * Find existing entities that a new one would duplicate. Every place that creates entities runs
 * this first (see "Avoiding duplicate entities" in the editor plan).
 * - `blocking`: same Wikidata ID, Wikipedia article, SEC CIK, FEC ID, outlet domain or social
 *   account. These are also enforced by unique indexes; checking first lets us offer the existing
 *   entity.
 * - `similar`: same normalized name or alias. Creating anyway requires a disambiguator.
 * @param {Object} candidate Fields of the entity about to be created or saved
 * @param {import('mongoose').Types.ObjectId} [excludeId] The entity being edited, which can't
 *   duplicate itself
 * @returns {Promise<{blocking: Object[], similar: Object[]}>}
 */
export async function findDuplicateEntities(candidate, excludeId) {
  const idConditions = [];
  if (candidate.ids?.wikidata) {
    idConditions.push({ 'ids.wikidata': candidate.ids.wikidata });
  }
  const article = wikipediaArticleUrl(candidate.ids?.wikipedia);
  if (article) {
    idConditions.push({ 'ids.wikipedia': article });
  }
  if (candidate.secCik) {
    idConditions.push({ secCik: candidate.secCik });
  }
  if (candidate.fecId) {
    idConditions.push({ fecId: candidate.fecId });
  }
  if (candidate.domains?.length) {
    idConditions.push({
      domains: { $in: candidate.domains.map(normalizeDomain) },
    });
  }
  if (candidate.accounts?.length) {
    idConditions.push({
      accountKeys: {
        $in: candidate.accounts.map(({ network, handle }) =>
          accountKey(network, handle),
        ),
      },
    });
  }

  const keys = [candidate.name, ...(candidate.aliases || []).map((a) => a.name)]
    .filter(Boolean)
    .map(nameKey);

  const notSelf = excludeId ? { _id: { $ne: excludeId } } : {};
  const [blocking, similar] = await Promise.all([
    idConditions.length
      ? Entity.find(
          { ...notSelf, $or: idConditions },
          ENTITY_SUMMARY_FIELDS,
        ).lean()
      : [],
    keys.length
      ? Entity.find(
          { ...notSelf, nameKeys: { $in: keys } },
          ENTITY_SUMMARY_FIELDS,
        ).lean()
      : [],
  ]);
  const blockingIds = new Set(blocking.map((e) => e._id.toString()));
  return {
    blocking,
    similar: similar.filter((e) => !blockingIds.has(e._id.toString())),
  };
}

/**
 * An entity's relations, each seen from this entity's side: `other` is the entity at the far end,
 * and `direction` says whether this entity is the relation's `from` or its `to`.
 * @param {import('mongoose').Types.ObjectId|string} entityId
 */
export async function relationsFor(
  entityId,
  { fields = ENTITY_SUMMARY_FIELDS } = {},
) {
  const id = String(entityId);
  const relations = await EntityRelation.find({
    $or: [{ from: entityId }, { to: entityId }],
  })
    .populate([
      { path: 'from', select: fields },
      { path: 'to', select: fields },
    ])
    .sort({ start: -1, createdAt: -1 })
    .lean();
  return relations
    .filter((relation) => relation.from && relation.to)
    .map(({ from, to, ...relation }) => {
      const isFrom = String(from._id) === id;
      return {
        ...relation,
        direction: isFrom ? 'from' : 'to',
        other: isFrom ? to : from,
      };
    });
}
