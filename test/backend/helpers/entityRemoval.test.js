import {
  mergedFields,
  replaceEntityIn,
} from '../../../backend/helpers/entityRemoval';

const DUP = '6aee86c409915a4eb9fee9a7';
const KEEP = '6aee86c409915a4eb9fee9a8';
const mention = (id, text) =>
  `<span class="mention" data-entity="${id}">${text}</span>`;

const post = {
  blocks: [
    {
      type: 'paragraph',
      data: { text: `A lot of ${mention(DUP, 'Taylor')}’s work` },
    },
    {
      type: 'document',
      data: {
        entity: { _id: DUP, name: 'Lorenz v. X', type: 'case' },
        recipients: {
          people: [
            {
              name: 'Ms. Lorenz',
              role: '',
              entity: { _id: DUP, name: 'Taylor Lorenz', type: 'person' },
            },
          ],
        },
      },
    },
    {
      type: 'paragraph',
      data: { text: `Unrelated ${mention(KEEP, 'Other')}` },
    },
  ],
};

describe('removing an entity from posts', () => {
  it('turns its mentions into the words as written, and drops it from documents', () => {
    const out = replaceEntityIn(post, DUP, null);
    expect(out.blocks[0].data.text).toBe('A lot of Taylor’s work');
    expect(out.blocks[1].data.entity).toBeNull();
    expect(out.blocks[1].data.recipients.people[0]).toEqual({
      name: 'Ms. Lorenz',
      role: '',
      entity: null,
    });
    expect(out.blocks[2]).toEqual(post.blocks[2]); // Other entities untouched
  });

  it('points its mentions and references at the entity merged into', () => {
    const keep = {
      _id: KEEP,
      name: 'Taylor Lorenz',
      type: 'person',
      accounts: [],
    };
    const out = replaceEntityIn(post, DUP, keep);
    expect(out.blocks[0].data.text).toBe(
      `A lot of ${mention(KEEP, 'Taylor')}’s work`,
    );
    expect(out.blocks[1].data.recipients.people[0].entity).toEqual({
      _id: KEEP,
      name: 'Taylor Lorenz',
      type: 'person',
    });
    expect(post.blocks[0].data.text).toContain(DUP); // Original untouched
  });
});

describe('merging entities', () => {
  it('adds what the kept entity lacks, without changing what it has', () => {
    const keep = {
      type: 'person',
      name: 'Taylor Lorenz',
      description: 'Journalist',
      accounts: [{ network: 'bluesky', handle: 'taylorlorenz.bsky.social' }],
      aliases: [],
      ids: { website: 'https://www.usermag.co' },
    };
    const duplicate = {
      type: 'person',
      name: 'Ms. Lorenz',
      description: 'Writer',
      accounts: [
        { network: 'bluesky', handle: '@TaylorLorenz.bsky.social' }, // Same account
        { network: 'twitter', handle: 'TaylorLorenz' },
      ],
      aliases: [{ name: 'Taylor Lorenz', kind: 'other' }],
      ids: { wikipedia: 'https://en.wikipedia.org/wiki/Taylor_Lorenz' },
      note: 'From the migration',
    };
    const set = mergedFields(keep, duplicate);
    expect(set.description).toBeUndefined(); // Kept as it was
    expect(set.accounts).toEqual([
      ...keep.accounts,
      { network: 'twitter', handle: 'TaylorLorenz' },
    ]);
    expect(set['ids.wikipedia']).toBe(
      'https://en.wikipedia.org/wiki/Taylor_Lorenz',
    );
    expect(set['ids.website']).toBeUndefined();
    expect(set.note).toBe('From the migration');
    // The duplicate's name becomes another name; its alias is the kept entity's own name
    expect(set.aliases).toEqual([{ name: 'Ms. Lorenz', kind: 'other' }]);
  });
});
