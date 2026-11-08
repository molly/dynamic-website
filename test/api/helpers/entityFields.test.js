import {
  SIDE_SECTIONS,
  TYPE_FIELDS,
  fieldsFor,
  sectionOf,
} from '../../../api/helpers/entityFields';
import { ENTITY_TYPES } from '../../../api/helpers/entityTypes';

describe('entity editor sections', () => {
  const sections = new Set(['head', 'main', ...SIDE_SECTIONS.map((s) => s.id)]);

  it('puts every field of every type somewhere on the form', () => {
    for (const type of ENTITY_TYPES) {
      for (const field of fieldsFor(type)) {
        expect(sections.has(sectionOf(field))).toBe(true);
      }
    }
  });

  it('starts every type with its name, description and note, like its page', () => {
    for (const type of ENTITY_TYPES) {
      expect(
        fieldsFor(type)
          .filter((f) => sectionOf(f) === 'head')
          .map((f) => f.name),
      ).toEqual(['name', 'disambiguator', 'description', 'note']);
    }
  });

  it('keeps the type-specific lists in the main column', () => {
    expect(sectionOf({ name: 'versions' })).toBe('main');
    expect(sectionOf({ name: 'candidacies' })).toBe('main');
    expect(sectionOf({ name: 'court' })).toBe('glance');
    expect(sectionOf({ name: 'secCik' })).toBe('identifiers');
  });

  it('has a type field list for every type', () => {
    for (const type of ENTITY_TYPES) {
      expect(TYPE_FIELDS[type]).toBeDefined();
    }
  });
});

describe('entities with nothing filled in', () => {
  it('checks every field on the form except the name and the page checkbox', async () => {
    const { bareEntitiesQuery } = await import(
      '../../../backend/helpers/entities'
    );
    const paths = bareEntitiesQuery().$and.map((c) => Object.keys(c)[0]);
    const formFields = new Set(
      ENTITY_TYPES.flatMap((type) => fieldsFor(type).map((f) => f.name)),
    );
    expect(new Set(paths)).toEqual(
      new Set([...formFields].filter((n) => n !== 'name' && n !== 'hasPage')),
    );
    const condition = (path) =>
      bareEntitiesQuery().$and.find((c) => path in c)[path].$in;
    expect(condition('accounts')).toEqual([null, []]);
    expect(condition('description')).toEqual([null, '']);
    expect(condition('kind')).toEqual([null, '', 'company']); // The model's default
  });
});
