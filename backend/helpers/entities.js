import { Entity } from '../models/entity.model.js';
import { accountKey, nameKey, normalizeDomain } from './entityKeys.js';

// Fields returned wherever an entity is shown as a choice (pickers, "Did you mean...?").
export const ENTITY_SUMMARY_FIELDS = 'name type disambiguator hasPage';

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
 * @param {string} query
 * @param {number} limit
 */
export function searchEntities(query, limit = 20) {
  const key = nameKey(query || '');
  if (!key) {
    return Entity.find({}, ENTITY_SUMMARY_FIELDS)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();
  }
  const handle = query.trim().replace(/^@/, '').toLowerCase();
  return Entity.find(
    {
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
    .limit(limit)
    .lean();
}

/**
 * Find existing entities that a new one would duplicate. Every place that creates entities runs
 * this first (see "Avoiding duplicate entities" in the editor plan).
 * - `blocking`: same Wikidata ID, SEC CIK, FEC ID, outlet domain or social account. These are
 *   also enforced by unique indexes; checking first lets us offer the existing entity.
 * - `similar`: same normalized name or alias. Creating anyway requires a disambiguator.
 * @param {Object} candidate Fields of the entity about to be created
 * @returns {Promise<{blocking: Object[], similar: Object[]}>}
 */
export async function findDuplicateEntities(candidate) {
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

  const [blocking, similar] = await Promise.all([
    idConditions.length
      ? Entity.find({ $or: idConditions }, ENTITY_SUMMARY_FIELDS).lean()
      : [],
    keys.length
      ? Entity.find({ nameKeys: { $in: keys } }, ENTITY_SUMMARY_FIELDS).lean()
      : [],
  ]);
  const blockingIds = new Set(blocking.map((e) => e._id.toString()));
  return {
    blocking,
    similar: similar.filter((e) => !blockingIds.has(e._id.toString())),
  };
}
