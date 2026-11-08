import { easternDate } from '../../../api/helpers/easternDate';
import { relationLabel } from '../../../api/helpers/entityTypes';
import { entityUrl, typeForSegment } from '../../../api/helpers/entityUrls';
import {
  RELATION_NOUNS,
  byYear,
  countEntityEntries,
  currentMembers,
  entityEntriesQuery,
  entryRow,
} from '../../../backend/helpers/entityPage';

describe('entity pages', () => {
  it('has an address only for entities with a page', () => {
    expect(
      entityUrl({ type: 'bill', slug: 'clarity-act', hasPage: true }),
    ).toEqual('/entities/legislation/clarity-act');
    expect(
      entityUrl({ type: 'person', slug: 'someone', hasPage: false }),
    ).toBeNull();
    expect(typeForSegment('people')).toEqual('person');
    expect(typeForSegment('widgets')).toBeNull();
  });

  it('lists entries by year, with titles in italics', () => {
    const rows = [
      {
        __t: 'FeedEntryCitationNeeded',
        _id: 'c',
        title: 'An issue',
        slug: 'i',
        createdAt: new Date('2026-10-30T16:00:00Z'),
      },
      {
        __t: 'FeedEntryMicro',
        _id: 'm',
        micro: { slug: 'p', post: { blocks: [{ data: { text: 'A post' } }] } },
        createdAt: new Date('2025-03-05T16:00:00Z'),
      },
    ].map(entryRow);
    expect(rows[0]).toMatchObject({
      kind: 'newsletter',
      icon: 'envelope',
      date: 'Oct 30',
      italic: true,
      href: 'https://www.citationneeded.news/i',
    });
    expect(rows[1]).toMatchObject({
      kind: 'posts',
      italic: false,
      label: 'A post',
      href: '/micro/entry/p',
    });
    expect(byYear(rows).map((y) => [y.year, y.rows.length])).toEqual([
      [2026, 1],
      [2025, 1],
    ]);
  });

  it('names related entities from this page’s side', () => {
    expect(RELATION_NOUNS.sponsored.to).toEqual('sponsor');
    expect(RELATION_NOUNS.affiliated.from).toEqual('affiliate');
    expect(RELATION_NOUNS.member_of.to).toEqual('member');
    // Howard Lutnick (from) is parent of Brandon Lutnick (to): each page names the other
    expect(RELATION_NOUNS.parent_of.from).toEqual('child');
    expect(RELATION_NOUNS.parent_of.to).toEqual('parent');
    // Senate Banking (from) is part of the U.S. Senate (to)
    expect(RELATION_NOUNS.part_of.from).toEqual('part of');
    expect(RELATION_NOUNS.part_of.to).toEqual('part');
  });

  it('puts a relation in the past tense once it has ended', () => {
    const relation = { kind: 'works_at', direction: 'from' };
    expect(relationLabel(relation)).toBe('works at');
    expect(relationLabel({ ...relation, end: '2025-02' })).toBe('worked at');
    expect(
      relationLabel({ kind: 'part_of', direction: 'to', end: '2020' }),
    ).toBe('included');
    expect(relationLabel({ ...relation, direction: 'to', end: '2025' })).toBe(
      'employed',
    );
    // Kinds that already read as past stay as they are
    expect(
      relationLabel({ kind: 'gave_to', direction: 'from', end: '2024' }),
    ).toBe('gave to');
  });

  it('lists entries about the entity or with its tag', () => {
    expect(entityEntriesQuery({ _id: 'e1', tag: 't1' })).toEqual({
      deletedAt: null,
      $or: [{ about: 'e1' }, { tags: 't1' }],
    });
    expect(entityEntriesQuery({ _id: 'e2' }).$or).toEqual([{ about: 'e2' }]);
  });

  it('counts an entry once, whether it’s about the entity, tagged, or both', () => {
    const counts = countEntityEntries(
      [{ _id: 'coinbase', tag: 'tag-coinbase' }, { _id: 'grewal' }],
      [
        { about: ['coinbase'], tags: ['tag-coinbase'] }, // Both
        { about: [], tags: ['tag-coinbase'] }, // Tagged before entities
        { about: ['coinbase', 'grewal'], tags: [] },
        { about: [], tags: ['tag-other'] },
      ],
    );
    expect(counts.get('coinbase')).toBe(3);
    expect(counts.get('grewal')).toBe(1);
  });

  it('lists a committee’s current members, with their seats first', () => {
    const row = (name, label, more = {}) => ({
      kind: 'member_of',
      direction: 'to',
      current: true,
      name,
      label,
      ...more,
    });
    expect(
      currentMembers([
        row('Kim', 'member'),
        row('Warren', 'Ranking Member'),
        row('Brown', 'Ranking Member', { current: false }), // Left the seat
        row('Scott', 'Chair'),
        row('Banks', 'member'),
        row('Coinbase', 'employee', { kind: 'works_at' }),
      ]).map((m) => `${m.name}: ${m.label}`),
    ).toEqual([
      'Scott: Chair',
      'Warren: Ranking Member',
      'Banks: member',
      'Kim: member',
    ]);
  });
});

describe('dates typed without a time', () => {
  it('are midnight Eastern, so they show as that day in Eastern time', () => {
    const day = easternDate('2025-05-29');
    expect(day.toISOString()).toEqual('2025-05-29T04:00:00.000Z'); // EDT
    expect(easternDate('2025-01-15').toISOString()).toEqual(
      '2025-01-15T05:00:00.000Z',
    ); // EST
    expect(
      day.toLocaleDateString('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
      }),
    ).toEqual('May 29');
    const exact = new Date('2025-05-29T12:00:00Z');
    expect(easternDate(exact)).toBe(exact);
  });
});
