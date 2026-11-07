import { ShortformEntry } from '../models/entry.model.js';
import { expandMentionsInPost, loadMentionedEntities } from './mentions.js';

// What a post needs looked up before it can be shown: mentioned entities, and the reading
// entries that article cards and roundups point at.

// The fields the article card and roundup blocks show.
export const SHORTFORM_CARD_FIELDS =
  'title subtitle author work publisher href date excerpts completed started entryAdded';

// A post's blocks, with the blocks inside comparisons.
const withNestedBlocks = (blocks = []) =>
  blocks.flatMap((block) =>
    block.type === 'comparison'
      ? [
          block,
          ...[block.data?.left?.block, block.data?.right?.block].filter(
            Boolean,
          ),
        ]
      : [block],
  );

function referencedShortformIds(posts) {
  const ids = new Set();
  for (const post of posts) {
    for (const block of withNestedBlocks(post?.blocks)) {
      if (block.type === 'article' && block.data?.ref) {
        ids.add(String(block.data.ref));
      } else if (block.type === 'roundup') {
        for (const item of block.data?.items || []) {
          if (item.ref) {
            ids.add(String(item.ref));
          }
        }
      }
    }
  }
  return [...ids];
}

async function loadReferencedShortform(posts) {
  const ids = referencedShortformIds(posts);
  if (!ids.length) {
    return {};
  }
  const entries = await ShortformEntry.find(
    { _id: { $in: ids } },
    SHORTFORM_CARD_FIELDS,
  ).lean();
  return Object.fromEntries(entries.map((e) => [String(e._id), e]));
}

/**
 * Look up everything a set of posts refers to.
 * @param {{blocks: Object[]}[]} posts
 * @returns {Promise<{mentions: Object, shortform: Object}>}
 */
export async function loadPostContext(posts) {
  const [mentions, shortform] = await Promise.all([
    loadMentionedEntities(posts),
    loadReferencedShortform(posts),
  ]);
  return { mentions, shortform };
}

/**
 * A copy of a post ready for the site's renderer: mentions expanded, and current reading
 * entries attached to article cards and roundups.
 * @param {{blocks: Object[]}} post
 * @param {{mentions?: Object, shortform?: Object}} context From loadPostContext
 */
export function preparePostForDisplay(
  post,
  { mentions = {}, shortform = {} } = {},
) {
  const expanded = expandMentionsInPost(post, mentions);
  return {
    ...expanded,
    blocks: expanded.blocks.map((b) => attachEntries(b, shortform)),
  };
}

// Current reading entries for article cards and roundups, including those inside comparisons.
function attachEntries(block, shortform) {
  if (block.type === 'article') {
    return {
      ...block,
      data: { ...block.data, entry: shortform[String(block.data.ref)] },
    };
  }
  if (block.type === 'roundup') {
    return {
      ...block,
      data: {
        ...block.data,
        items: (block.data.items || []).map((item) => ({
          ...item,
          entry: shortform[String(item.ref)],
        })),
      },
    };
  }
  if (block.type === 'comparison') {
    const side = (slot) =>
      slot?.block
        ? { ...slot, block: attachEntries(slot.block, shortform) }
        : slot;
    return {
      ...block,
      data: {
        ...block.data,
        left: side(block.data.left),
        right: side(block.data.right),
      },
    };
  }
  return block;
}
