// A letter's senders and recipients. Each side of a document block is
//   { prefix, people: [{ name, role, entity }], more }
// prefix: a title shared by everyone listed ("Sens."); name: as the document writes it; role: an
// optional descriptor ("Secretary of Commerce"); entity: { _id, name, type } if they're an entity
// on the site; more: how many others signed or received it without being named.
// Shown as e.g. "Sens. Warren, Kim and 14 others → Howard Lutnick, Secretary of Commerce".

export const DOCUMENT_SIDES = ['senders', 'recipients'];

// Before a side could list several people, documents had one sender and one recipient:
// from, fromRole, fromEntity and to, toRole, toEntity. (backend/scripts/documentParties.js
// converts saved posts.)
const LEGACY_KEYS = { senders: 'from', recipients: 'to' };

// Only what's needed of an entity. (The entity picker once saved its own bookkeeping alongside.)
const cleanEntity = (entity) =>
  entity?._id
    ? { _id: entity._id, name: entity.name, type: entity.type }
    : null;

const cleanPerson = ({ name, role, entity, html } = {}) => ({
  name: String(name || '').trim(),
  role: String(role || '').trim(),
  entity: cleanEntity(entity),
  ...(html ? { html } : {}),
});

/**
 * One side of a document, in the current shape, from either shape.
 * @param {Object} data A document block's data
 * @param {'senders'|'recipients'} side
 * @returns {{prefix: string, people: Object[], more: number}}
 */
export function documentSide(data = {}, side) {
  const saved = data[side];
  if (saved) {
    return {
      prefix: String(saved.prefix || '').trim(),
      people: (saved.people || [])
        .map(cleanPerson)
        .filter((p) => p.name || p.entity),
      more: Math.max(0, Math.floor(Number(saved.more)) || 0),
    };
  }
  const key = LEGACY_KEYS[side];
  const person = cleanPerson({
    name: data[key],
    role: data[`${key}Role`],
    entity: data[`${key}Entity`],
  });
  return {
    prefix: '',
    people: person.name || person.entity ? [person] : [],
    more: 0,
  };
}

/**
 * A document's data with both sides in the current shape and the old one-person fields gone.
 * @param {Object} data
 */
export function withDocumentSides(data = {}) {
  const updated = { ...data };
  for (const side of DOCUMENT_SIDES) {
    updated[side] = documentSide(data, side);
    const key = LEGACY_KEYS[side];
    for (const legacy of [key, `${key}Role`, `${key}Entity`, `${key}Html`]) {
      delete updated[legacy];
    }
  }
  return updated;
}

/**
 * Whether a document still uses the old one-sender, one-recipient fields.
 * @param {Object} data
 */
export const hasLegacyParties = (data = {}) =>
  Object.values(LEGACY_KEYS).some((key) =>
    [key, `${key}Role`, `${key}Entity`, `${key}Html`].some(
      (field) => field in data,
    ),
  );

/**
 * Join names as a sentence: "A", "A and B", "A, B and C", or "A, B and 14 others".
 * @param {string[]} names
 * @param {number} [more] Others not named
 */
export function joinNames(names, more = 0) {
  const all = more
    ? [...names, `${more} ${more === 1 ? 'other' : 'others'}`]
    : names;
  if (all.length < 2) {
    return all.join('');
  }
  return `${all.slice(0, -1).join(', ')} and ${all[all.length - 1]}`;
}
