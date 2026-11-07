// Addresses of entity pages: /entities/<type>/<slug>, with the type's plural as its segment.

export const ENTITY_SEGMENTS = {
  person: 'people',
  organization: 'organizations',
  project: 'projects',
  committee: 'committees',
  bill: 'legislation',
  case: 'cases',
  enforcement: 'enforcement',
  event: 'events',
};

// How each type is named on its pages: the label over an entity's name, and its index's title.
export const ENTITY_TYPE_NAMES = {
  person: { one: 'Person', many: 'People' },
  organization: { one: 'Organization', many: 'Organizations' },
  project: { one: 'Project', many: 'Projects' },
  committee: { one: 'Political committee', many: 'Political committees' },
  bill: { one: 'Bill', many: 'Legislation' },
  case: { one: 'Court case', many: 'Court cases' },
  enforcement: { one: 'Enforcement action', many: 'Enforcement actions' },
  event: { one: 'Event', many: 'Events' },
};

/**
 * The type for a URL segment ("people" -> "person"), or null.
 * @param {string} segment
 */
export function typeForSegment(segment) {
  return (
    Object.keys(ENTITY_SEGMENTS).find(
      (type) => ENTITY_SEGMENTS[type] === segment,
    ) || null
  );
}

/**
 * An entity's page, or null when it has none (people mostly don't).
 * @param {{type: string, slug: string, hasPage?: boolean}} entity
 */
export function entityUrl(entity) {
  return entity?.hasPage && entity.slug && ENTITY_SEGMENTS[entity.type]
    ? `/entities/${ENTITY_SEGMENTS[entity.type]}/${entity.slug}`
    : null;
}
