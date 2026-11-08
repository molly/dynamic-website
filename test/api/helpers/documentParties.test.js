import {
  documentSide,
  hasLegacyParties,
  joinNames,
  withDocumentSides,
} from '../../../api/helpers/documentParties';

describe('joinNames', () => {
  it('joins names as a sentence', () => {
    expect(joinNames([])).toBe('');
    expect(joinNames(['A'])).toBe('A');
    expect(joinNames(['A', 'B'])).toBe('A and B');
    expect(joinNames(['A', 'B', 'C'])).toBe('A, B and C');
  });

  it('ends with the others not named', () => {
    expect(joinNames(['A', 'B'], 14)).toBe('A, B and 14 others');
    expect(joinNames(['A'], 1)).toBe('A and 1 other');
    expect(joinNames([], 3)).toBe('3 others');
  });
});

describe('document sides', () => {
  const entity = { _id: 'e1', name: 'Howard Lutnick', type: 'person' };

  it('reads the one-person fields documents used to have', () => {
    const old = {
      title: 'Letter',
      from: 'Senate Banking',
      to: 'Howard Lutnick',
      toRole: 'Commerce Secretary',
      toEntity: entity,
    };
    expect(hasLegacyParties(old)).toBe(true);
    const converted = withDocumentSides(old);
    expect(converted).toEqual({
      title: 'Letter',
      senders: {
        prefix: '',
        people: [{ name: 'Senate Banking', role: '', entity: null }],
        more: 0,
      },
      recipients: {
        prefix: '',
        people: [
          { name: 'Howard Lutnick', role: 'Commerce Secretary', entity },
        ],
        more: 0,
      },
    });
    expect(hasLegacyParties(converted)).toBe(false);
    expect(withDocumentSides(converted)).toEqual(converted); // Safe to run again
  });

  it('keeps only what it needs of an entity', () => {
    const picked = {
      ...entity,
      $order: 1,
      $id: 'tomselect-11-opt-1',
      $option: {},
    };
    expect(
      documentSide({ toEntity: picked, to: 'Howard Lutnick' }, 'recipients')
        .people[0].entity,
    ).toEqual(entity);
  });

  it('has nobody on a side that was left empty', () => {
    expect(documentSide({}, 'senders')).toEqual({
      prefix: '',
      people: [],
      more: 0,
    });
  });

  it('drops empty rows and odd counts', () => {
    expect(
      documentSide(
        {
          senders: {
            prefix: ' Sens. ',
            people: [{ name: 'Warren' }, { name: ' ' }, { entity }],
            more: '-2',
          },
        },
        'senders',
      ),
    ).toEqual({
      prefix: 'Sens.',
      people: [
        { name: 'Warren', role: '', entity: null },
        { name: '', role: '', entity },
      ],
      more: 0,
    });
  });
});
