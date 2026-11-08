import { collectMentionIds } from '../../api/helpers/mentions.js';
import { Entity } from '../models/entity.model.js';

// Loading mentioned entities. Turning them into markup is in mentionMarkup.js, which doesn't need
// the database.
export { expandMentionsInPost, renderMention } from './mentionMarkup.js';

/**
 * Load the entities mentioned in a set of posts.
 * @param {{blocks: Object[]}[]} posts
 * @returns {Promise<Object>} Entities by id
 */
export async function loadMentionedEntities(posts) {
  const ids = collectMentionIds(posts);
  if (!ids.length) {
    return {};
  }
  const entities = await Entity.find(
    { _id: { $in: ids } },
    'name accounts ids.wikipedia hasPage slug type',
  ).lean();
  return Object.fromEntries(entities.map((e) => [String(e._id), e]));
}

/**
 * Websites of the entities mentioned in posts, which get webmentions like any other link.
 * @param {{blocks: Object[]}[]} posts
 * @returns {Promise<string[]>}
 */
export async function mentionedWebsites(posts) {
  const entities = await loadMentionedEntities(posts);
  return Object.values(entities).flatMap((entity) =>
    (entity.accounts || [])
      .filter((a) => a.network === 'website' && /^https?:\/\//.test(a.handle))
      .map((a) => a.handle),
  );
}
