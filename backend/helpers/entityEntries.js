// Which feed entries belong to an entity: its page lists those marked as about it, those with its
// tag, and press it was in (a talk's fellow panelist, a podcast's guest: PressEntry.people). Used
// by entity pages (entityPage.js) and kept free of imports, so anything can use it.

const idOf = (value) => String(value?._id ?? value);

/**
 * The feed entries an entity's page lists: those marked as about it, those with its tag (so
 * posts tagged before entities existed show up without being marked again), and the feed entries
 * of press it was in.
 * @param {{_id: *, tag?: *}} entity
 * @param {{pressIds?: *[]}} [options] Press entries listing the entity among their people
 */
export function entityEntriesQuery(entity, { pressIds = [] } = {}) {
  return {
    deletedAt: null,
    $or: [
      { about: entity._id },
      ...(entity.tag ? [{ tags: entity.tag }] : []),
      ...(pressIds.length ? [{ press: { $in: pressIds } }] : []),
    ],
  };
}

/**
 * How many entries each entity has, counting an entry once even when it's about the entity, has
 * its tag and has it among its press's people.
 * @param {{_id: *, tag?: *}[]} entities
 * @param {{about?: *[], tags?: *[], people?: *[]}[]} entries people: its press's people
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
      ...(entry.people || []).map(idOf),
    ]);
    for (const id of ids) {
      counts.set(id, (counts.get(id) || 0) + 1);
    }
  }
  return counts;
}
