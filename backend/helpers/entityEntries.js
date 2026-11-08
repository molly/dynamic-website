// Which feed entries belong to an entity: its page lists those marked as about it, and those with
// its tag. Used by entity pages (entityPage.js) and kept free of imports, so anything can use it.

const idOf = (value) => String(value?._id ?? value);

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
