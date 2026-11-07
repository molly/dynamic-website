import { Entity, EntityRelation } from '../models/entity.model.js';
import { accountKey, nameKey, normalizeDomain } from './entityKeys.js';

// Fields returned wherever an entity is shown as a choice (pickers, "Did you mean...?").
export const ENTITY_SUMMARY_FIELDS = 'name type disambiguator hasPage accounts';

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Model for an entity type, so documents get that type's fields and validation.
 * @param {string} type
 * @returns {import('mongoose').Model|undefined}
 */
export function entityModelFor(type) {
  return Entity.discriminators?.[type];
}

/**
 * Search names, aliases and handles. Words match from their start, so "grew" finds "Paul Grewal".
 * With no query, returns the most recently updated entities.
 * @param {string} query
 * @param {{limit?: number, skip?: number, type?: string}} options
 */
export function searchEntities(query, { limit = 20, skip = 0, type } = {}) {
  const typeFilter = type ? { type } : {};
  const key = nameKey(query || '');
  if (!key) {
    return Entity.find(typeFilter, ENTITY_SUMMARY_FIELDS)
      .sort({ updatedAt: -1 })
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
    ENTITY_SUMMARY_FIELDS,
  )
    .sort({ name: 1 })
    .skip(skip)
    .limit(limit)
    .lean();
}

/**
 * Find existing entities that a new one would duplicate. Every place that creates entities runs
 * this first (see "Avoiding duplicate entities" in the editor plan).
 * - `blocking`: same Wikidata ID, SEC CIK, FEC ID, outlet domain or social account. These are
 *   also enforced by unique indexes; checking first lets us offer the existing entity.
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
export async function relationsFor(entityId) {
  const id = String(entityId);
  const relations = await EntityRelation.find({
    $or: [{ from: entityId }, { to: entityId }],
  })
    .populate([
      { path: 'from', select: ENTITY_SUMMARY_FIELDS },
      { path: 'to', select: ENTITY_SUMMARY_FIELDS },
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
