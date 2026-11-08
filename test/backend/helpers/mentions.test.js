import {
  collectMentionIds,
  mentionMarkup,
  mentionSignature,
  parseLegacyMentions,
  replaceLegacyMentions,
} from '../../../api/helpers/mentions';
import {
  entityNameLink,
  pressAuthorHtml,
  pressWithHtml,
  expandMentionsInPost,
  renderMention,
} from '../../../backend/helpers/mentionMarkup';
import { renderDocument } from '../../../api/helpers/sourceBlocks';
import { processText } from '../../../backend/helpers/social';
import { transformMicroEntry } from '../../../backend/scripts/copyTransforms';
import { buildThread } from '../../../frontend/js/threads/buildThread';

const ID = '6aee86c409915a4eb9fee9a7';
const ENTITY = {
  _id: ID,
  name: 'Taylor Lorenz',
  accounts: [
    { network: 'bluesky', handle: 'taylorlorenz.bsky.social' },
    { network: 'mastodon', handle: 'taylor@mastodon.social' },
    { network: 'website', handle: 'https://www.usermag.co' },
  ],
};
const ENTITIES = { [ID]: ENTITY };
const POST_TEXT = `A lot of ${mentionMarkup(ID, 'Taylor Lorenz')}’s announcement`;

// The markup the previous mentions tool wrote into posts
const LEGACY = `<span class="cdx-mention u-category h-card"><span class="cdx-mention-plain">Molly White</span> <span class="cdx-mention-social-group"><a class="twitter u-url cdx-social-link" href="https://twitter.com/molly0xFFF" data-username="molly0xFFF" title="Twitter"><span class="cdx-mention-icon icon"></span></a><a class="bluesky u-url cdx-social-link" href="https://bsky.app/profile/molly.wiki" data-username="molly.wiki" title="Bluesky"></a></span></span>`;

describe('collectMentionIds', () => {
  it('finds mentions in any block', () => {
    expect(
      collectMentionIds([
        { blocks: [{ type: 'paragraph', data: { text: POST_TEXT } }] },
        { blocks: [{ type: 'list', data: { items: [POST_TEXT] } }] },
        { blocks: [] },
      ]),
    ).toEqual([ID]);
  });
});

describe('document senders and recipients', () => {
  const OTHER = '0'.repeat(23) + '1';
  const letter = {
    type: 'document',
    data: {
      docType: 'letter',
      senders: {
        prefix: '',
        people: [
          {
            name: 'Ms. Lorenz',
            role: 'journalist',
            entity: { _id: ID, name: 'Taylor Lorenz', type: 'person' },
          },
        ],
        more: 0,
      },
      recipients: {
        prefix: '',
        people: [
          {
            name: 'Senate Banking',
            role: 'minority staff',
            entity: { _id: OTHER, name: 'Senate Banking', type: 'committee' },
          },
        ],
        more: 0,
      },
    },
  };

  it('counts as mentioning them, in comparisons too', () => {
    expect(collectMentionIds([{ blocks: [letter] }])).toEqual([ID, OTHER]);
    expect(
      collectMentionIds([
        {
          blocks: [
            {
              type: 'comparison',
              data: { left: { block: letter }, right: {} },
            },
          ],
        },
      ]),
    ).toEqual([ID, OTHER]);
  });

  it('shows a sender that is an entity in bold, linked to it, with the name as written', () => {
    const [doc] = expandMentionsInPost({ blocks: [letter] }, ENTITIES).blocks;
    const [sender] = doc.data.senders.people;
    // No page, so its website; not the purple @ mention, which is for your own writing
    expect(sender.html).toEqual(
      '<a class="document-party" href="https://www.usermag.co"><strong>Ms. Lorenz</strong></a>',
    );
    // An entity that isn't loaded (e.g. deleted) stays as the name written
    expect(doc.data.recipients.people[0].html).toBeUndefined();
    const html = renderDocument({ data: doc.data });
    expect(html).toContain(
      '<p class="document-meta">→ Senate Banking, minority staff</p>',
    );
    expect(html).toContain(
      `<p class="document-from">from ${sender.html}, journalist</p>`,
    );
    expect(letter.data.senders.people[0].html).toBeUndefined(); // Original untouched
  });

  it('lists several people, with their titles in parentheses, and how many others', () => {
    const many = {
      ...letter,
      data: {
        ...letter.data,
        senders: {
          prefix: 'Sens.',
          people: [
            { name: 'Lorenz', entity: { _id: ID } },
            { name: 'Kim', role: 'Ranking Member' },
          ],
          more: 14,
        },
      },
    };
    const [doc] = expandMentionsInPost({ blocks: [many] }, ENTITIES).blocks;
    expect(renderDocument({ data: doc.data })).toContain(
      `from Sens. ${doc.data.senders.people[0].html}, Kim (Ranking Member) and 14 others</p>`,
    );
  });

  it('reads documents saved with one sender and one recipient', () => {
    const old = {
      type: 'document',
      data: {
        docType: 'letter',
        from: 'Ms. Lorenz',
        fromEntity: { _id: ID, name: 'Taylor Lorenz', type: 'person' },
        fromRole: 'journalist',
        to: 'Senate Banking',
        fromHtml: '<script>x</script>',
      },
    };
    expect(collectMentionIds([{ blocks: [old] }])).toEqual([ID]);
    const [doc] = expandMentionsInPost({ blocks: [old] }, ENTITIES).blocks;
    expect(doc.data.from).toBeUndefined();
    expect(doc.data.fromHtml).toBeUndefined();
    const html = renderDocument({ data: doc.data });
    expect(html).toContain('→ Senate Banking</p>');
    expect(html).toContain(
      `from ${doc.data.senders.people[0].html}, journalist</p>`,
    );
  });

  it('never shows saved markup for a sender', () => {
    const saved = {
      ...letter,
      data: {
        ...letter.data,
        recipients: {
          people: [{ name: 'Senate Banking', html: '<script>x</script>' }],
        },
      },
    };
    const [doc] = expandMentionsInPost({ blocks: [saved] }, ENTITIES).blocks;
    expect(doc.data.recipients.people[0].html).toBeUndefined();
    expect(renderDocument({ data: doc.data })).not.toContain('<script>');
  });
});

describe('legacy mentions', () => {
  it('reads the name and accounts', () => {
    expect(parseLegacyMentions(`Hi ${LEGACY}`)).toEqual([
      {
        name: 'Molly White',
        accounts: [
          { network: 'twitter', handle: 'molly0xFFF' },
          { network: 'bluesky', handle: 'molly.wiki' },
        ],
        wikipedia: null,
      },
    ]);
  });

  it('reads a Wikipedia link as the article about them, not an account', () => {
    const withArticle = LEGACY.replace(
      '</span></span>',
      '</span><a class="wikipedia u-url cdx-social-link" href="https://en.wikipedia.org/wiki/Molly_White_(writer)" data-username="Molly White (writer)"></a></span>',
    );
    const [mention] = parseLegacyMentions(withArticle);
    expect(mention.accounts.map((a) => a.network)).toEqual([
      'twitter',
      'bluesky',
    ]);
    expect(mention.wikipedia).toBe(
      'https://en.wikipedia.org/wiki/Molly_White_(writer)',
    );
  });

  it('replaces resolved ones and leaves the rest', () => {
    expect(replaceLegacyMentions(`Hi ${LEGACY}!`, () => ID)).toEqual(
      `Hi ${mentionMarkup(ID, 'Molly White')}!`,
    );
    expect(replaceLegacyMentions(`Hi ${LEGACY}`, () => null)).toContain(
      'cdx-mention',
    );
  });

  it('gives the same signature regardless of handle case or account order', () => {
    expect(
      mentionSignature({
        name: 'Molly White',
        accounts: [
          { network: 'twitter', handle: 'molly0xFFF' },
          { network: 'bluesky', handle: 'molly.wiki' },
        ],
      }),
    ).toEqual(
      mentionSignature({
        name: 'molly white',
        accounts: [
          { network: 'bluesky', handle: '@Molly.Wiki' },
          { network: 'twitter', handle: 'molly0xfff' },
        ],
      }),
    );
  });
});

describe('site markup', () => {
  it('shows the name as written, linked to the entity’s page', () => {
    expect(
      renderMention(
        { ...ENTITY, type: 'person', slug: 'taylor-lorenz', hasPage: true },
        'Taylor Lorenz’s',
      ),
    ).toBe(
      '<span class="mention h-card"><a class="mention-name entity-page p-name" href="/entities/people/taylor-lorenz">Taylor Lorenz’s</a></span>',
    );
  });

  it('links to the website without a page, and is plain text without either', () => {
    expect(renderMention(ENTITY, 'Taylor')).toBe(
      '<span class="mention h-card"><a class="mention-name website u-url p-name" href="https://www.usermag.co">Taylor</a></span>',
    );
    expect(
      renderMention(
        { name: 'Paul Grewal', type: 'person', accounts: [] },
        'Grewal',
      ),
    ).toBe(
      '<span class="mention h-card"><span class="mention-name p-name">Grewal</span></span>',
    );
  });

  it('links just the name beside a post, without account icons', () => {
    // No page, so its website
    expect(entityNameLink(ENTITY)).toBe(
      '<a class="website u-url p-name" href="https://www.usermag.co">Taylor Lorenz</a>',
    );
    expect(
      entityNameLink({ name: 'Paul Grewal', type: 'person', accounts: [] }),
    ).toBe('Paul Grewal');
    expect(entityNameLink({ ...ENTITY, name: 'A & B' })).toContain('A &amp; B');
  });

  it('sets cases’ and outlets’ names in italics, except in post text', () => {
    const outlet = {
      name: 'The Verge',
      type: 'organization',
      kind: 'outlet',
      slug: 'the-verge',
      hasPage: true,
    };
    // A mention is the words as written
    expect(renderMention(outlet, 'the Verge')).toContain(
      'href="/entities/organizations/the-verge">the Verge</a>',
    );
    expect(entityNameLink(outlet)).toContain('<i>The Verge</i>');
    expect(
      entityNameLink({ name: 'SEC v. Coinbase', type: 'case', accounts: [] }),
    ).toBe('<i>SEC v. Coinbase</i>');
    // Other organizations aren't
    expect(entityNameLink({ ...outlet, kind: 'company' })).not.toContain('<i>');
  });

  it('expands mentions in a post, and shows unknown entities as text', () => {
    const post = {
      blocks: [
        { type: 'paragraph', data: { text: POST_TEXT } },
        {
          type: 'paragraph',
          data: { text: mentionMarkup('0'.repeat(24), 'Gone') },
        },
      ],
    };
    const expanded = expandMentionsInPost(post, ENTITIES);
    expect(expanded.blocks[0].data.text).toContain('h-card');
    expect(expanded.blocks[1].data.text).toEqual('Gone');
    expect(post.blocks[0].data.text).toEqual(POST_TEXT); // Original untouched
  });
});

describe('people in a talk or appearance', () => {
  const panelist = {
    name: 'Paul Grewal',
    type: 'person',
    slug: 'paul-grewal',
    hasPage: true,
  };

  it('shows who wrote it as entities, linked, or else as written', () => {
    expect(pressAuthorHtml({ author: 'Ezra & Co' })).toBe('Ezra &amp; Co');
    expect(
      pressAuthorHtml({
        author: 'Paul Grewal and Jo',
        authors: [panelist, { name: 'Jo', type: 'person' }],
      }),
    ).toBe(
      '<a class="entity-page p-name" href="/entities/people/paul-grewal">Paul Grewal</a> and Jo',
    );
    // An author entity that's since been deleted doesn't hide the name as written
    expect(pressAuthorHtml({ author: 'Ezra', authors: [undefined] })).toBe(
      'Ezra',
    );
    expect(pressAuthorHtml({})).toBeNull();
  });

  it('lists the host, then the others, linked to their pages', () => {
    expect(
      pressWithHtml({
        author: 'Ezra & Co',
        people: [panelist, { name: 'Jo', type: 'person' }],
      }),
    ).toBe(
      'Ezra &amp; Co, <a class="entity-page p-name" href="/entities/people/paul-grewal">Paul Grewal</a> and Jo',
    );
    expect(pressWithHtml({ people: [panelist] })).toContain('Paul Grewal</a>');
    expect(pressWithHtml({ author: 'Ezra' })).toBe('Ezra');
    expect(pressWithHtml({ people: [] })).toBeNull();
  });
});

describe('cross-posting mentions', () => {
  it("uses the entity's handle on each network", () => {
    expect(processText(POST_TEXT, 'mastodon', ENTITIES).text).toEqual(
      'A lot of @taylor@mastodon.social’s announcement',
    );
    expect(processText(POST_TEXT, 'bluesky', ENTITIES).plainText).toEqual(
      'A lot of @taylorlorenz.bsky.social’s announcement',
    );
  });

  it('falls back to the words as written', () => {
    expect(processText(POST_TEXT, 'twitter', ENTITIES).text).toEqual(
      'A lot of Taylor Lorenz’s announcement',
    );
    expect(processText(POST_TEXT, 'twitter').text).toEqual(
      'A lot of Taylor Lorenz’s announcement',
    );
  });

  it('builds threads with handles', () => {
    const thread = buildThread(
      { blocks: [{ type: 'paragraph', data: { text: POST_TEXT } }] },
      'mastodon',
      '',
      ENTITIES,
    );
    expect(thread.posts[0].text).toEqual(
      'A lot of @taylor@mastodon.social’s announcement',
    );
  });
});

describe('copy transform', () => {
  it('converts old mentions it has ids for', () => {
    const [mention] = parseLegacyMentions(LEGACY);
    const doc = transformMicroEntry(
      {
        slug: 'a',
        post: {
          blocks: [{ type: 'paragraph', data: { text: `Hi ${LEGACY}` } }],
        },
      },
      new Map([[mentionSignature(mention), ID]]),
    );
    expect(doc.post.blocks[0].data.text).toEqual(
      `Hi ${mentionMarkup(ID, 'Molly White')}`,
    );
  });

  it('leaves deleted entries without a post alone', () => {
    expect(transformMicroEntry({ slug: 'b', deletedAt: 1 })).toEqual({
      slug: 'b',
      deletedAt: 1,
      relatedPosts: [],
    });
  });
});
