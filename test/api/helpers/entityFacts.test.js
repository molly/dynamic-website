import {
  accountRows,
  billStatusLabel,
  congressOn,
  elsewhereRows,
  formatUsd,
  formerNames,
  typeFacts,
} from '../../../api/helpers/entityFacts';

describe('entity page details', () => {
  it('formats amounts', () => {
    expect(formatUsd(25000)).toBe('$25,000');
    expect(formatUsd(4500000)).toBe('$4.5 million');
    expect(formatUsd(250000000)).toBe('$250 million');
    expect(formatUsd(1200000000)).toBe('$1.2 billion');
    expect(formatUsd(undefined)).toBeNull();
  });

  it('lists accounts apart from pages about them elsewhere, as label and value rows', () => {
    const entity = {
      name: 'Elizabeth Warren',
      ids: {
        wikipedia: 'https://en.wikipedia.org/wiki/Elizabeth_Warren',
      },
      accounts: [
        { network: 'twitter', handle: 'SenWarren' },
        { network: 'bluesky', handle: 'elizabeth-warren.bsky.social' },
        { network: 'website', handle: 'https://www.warren.senate.gov/' },
        { network: 'website', handle: 'https://elizabethwarren.com/' },
        { network: 'youtube', handle: 'UCTH9zV8Imw09J5bOoTR18_A' },
      ],
      elsewhere: [
        {
          label: 'FEC',
          url: 'https://www.fec.gov/data/candidate/S2MA00170/',
        },
      ],
    };
    // Their websites, all of them, then their accounts
    expect(accountRows(entity)).toEqual([
      {
        label: 'website',
        value: 'warren.senate.gov',
        href: 'https://www.warren.senate.gov/',
      },
      {
        label: 'website',
        value: 'elizabethwarren.com',
        href: 'https://elizabethwarren.com/',
      },
      {
        label: 'Twitter',
        value: '@SenWarren',
        href: 'https://twitter.com/SenWarren',
      },
      {
        label: 'Bluesky',
        value: '@elizabeth-warren.bsky.social',
        href: 'https://bsky.app/profile/elizabeth-warren.bsky.social',
      },
      {
        label: 'YouTube',
        value: 'channel',
        href: 'https://www.youtube.com/channel/UCTH9zV8Imw09J5bOoTR18_A',
      },
    ]);
    // Pages about them elsewhere: yours, then Wikipedia
    expect(elsewhereRows(entity)).toEqual([
      {
        label: 'FEC',
        value: 'Elizabeth Warren',
        href: 'https://www.fec.gov/data/candidate/S2MA00170/',
      },
      {
        label: 'Wikipedia',
        value: 'Elizabeth Warren',
        href: 'https://en.wikipedia.org/wiki/Elizabeth_Warren',
      },
    ]);
  });

  it('shows each type’s own facts', () => {
    const value = (entity, label) =>
      typeFacts(entity).find((row) => row.label === label)?.value;
    expect(
      value(
        {
          type: 'enforcement',
          outcome: { kind: 'settlement', amountUsd: 4300000000 },
        },
        'outcome',
      ),
    ).toBe('settlement · $4.3 billion');
    expect(
      value({ type: 'event', startDate: '2024', endDate: '2024-11' }, 'dates'),
    ).toBe('2024 – Nov 2024');
    expect(value({ type: 'event', startDate: '2024-11-05' }, 'dates')).toBe(
      'Nov 5, 2024',
    );
    expect(
      typeFacts({
        type: 'event',
        amounts: [{ label: 'raised', amountUsd: 202000000 }],
      }),
    ).toContainEqual({ label: 'raised', value: '$202 million' });
    expect(
      value(
        { type: 'case', filedAt: new Date('2025-05-29T04:00:00Z') },
        'filed',
      ),
    ).toBe('May 29, 2025');
    expect(value({ type: 'bill', chamber: 'senate' }, 'chamber')).toBe(
      'senate',
    );
    expect(typeFacts({ type: 'person' })).toEqual([]);
  });

  it('lists former names only', () => {
    expect(
      formerNames({
        aliases: [
          { name: 'Meta Platforms, Inc.', kind: 'other' },
          {
            name: 'Facebook',
            kind: 'former',
            until: new Date('2021-10-28T04:00:00Z'),
          },
        ],
      }),
    ).toBe('formerly Facebook (until Oct 2021)');
    expect(
      formerNames({ aliases: [{ name: 'FB', kind: 'other' }] }),
    ).toBeNull();
  });

  it('knows which Congress is sitting', () => {
    expect(congressOn(new Date('2026-11-08T12:00:00-05:00'))).toBe(119);
    expect(congressOn(new Date('2025-01-03T12:00:00-05:00'))).toBe(119);
    expect(congressOn(new Date('2025-01-02T12:00:00-05:00'))).toBe(118);
    expect(congressOn(new Date('1789-03-04T12:00:00-05:00'))).toBe(1);
  });

  it('shows a bill from an ended Congress that got no further as having died', () => {
    const now = new Date('2026-11-08T12:00:00-05:00');
    const label = (bill) => billStatusLabel(bill, now);
    expect(label({ billStatus: 'introduced', congress: 119 })).toBe(
      'introduced',
    );
    expect(label({ billStatus: 'introduced', congress: 118 })).toBe(
      'died in committee',
    );
    expect(label({ billStatus: 'passed House', congress: 118 })).toBe(
      'passed House, then died',
    );
    expect(label({ billStatus: 'became law', congress: 118 })).toBe(
      'became law',
    );
    expect(label({ billStatus: 'vetoed', congress: 118 })).toBe('vetoed');
    // Without a Congress (a state bill), as saved
    expect(label({ billStatus: 'introduced' })).toBe('introduced');
    expect(label({ congress: 118 })).toBeNull();
  });
});
