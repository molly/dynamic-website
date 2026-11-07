import {
  collectMentionIds,
  mentionMarkup,
  mentionSignature,
  parseLegacyMentions,
  replaceLegacyMentions,
} from '../../../api/helpers/mentions';
import {
  expandMentionsInPost,
  renderMention,
} from '../../../backend/helpers/mentionMarkup';
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

describe('legacy mentions', () => {
  it('reads the name and accounts', () => {
    expect(parseLegacyMentions(`Hi ${LEGACY}`)).toEqual([
      {
        name: 'Molly White',
        accounts: [
          { network: 'twitter', handle: 'molly0xFFF' },
          { network: 'bluesky', handle: 'molly.wiki' },
        ],
      },
    ]);
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
  it('builds an h-card from the entity', () => {
    const html = renderMention(ENTITY, 'Taylor Lorenz');
    expect(html).toContain('class="cdx-mention u-category h-card"');
    expect(html).toContain(
      '<a class="website u-url p-name" href="https://www.usermag.co"><span class="cdx-mention-plain">Taylor Lorenz</span></a>',
    );
    expect(html).toContain('href="https://mastodon.social/@taylor"');
    expect(html).toContain(
      'href="https://bsky.app/profile/taylorlorenz.bsky.social"',
    );
    // Mastodon comes before Bluesky, as on the site
    expect(html.indexOf('mastodon u-url')).toBeLessThan(
      html.indexOf('bluesky u-url'),
    );
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
