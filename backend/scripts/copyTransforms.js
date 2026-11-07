// How copyToSite.js reshapes old documents. Kept separate so they can be tested without
// running the copy.
import {
  mapPostText,
  mentionSignature,
  replaceLegacyMentions,
} from '../../api/helpers/mentions.js';

/**
 * Micro entries:
 * - relatedPost/relatedPostModel (one article or press piece) became a list.
 * - Old-format mentions become current-format ones, using the entity ids resolved beforehand
 *   (see resolveLegacyMentions). Mentions without an id are left as they are.
 * @param {Object} doc
 * @param {Map<string, ?string>} [mentionIds] Entity ids by mentionSignature
 */
export function transformMicroEntry(
  { relatedPost, relatedPostModel, ...doc },
  mentionIds = new Map(),
) {
  return {
    ...doc,
    ...(doc.post
      ? {
          post: mapPostText(doc.post, (html) =>
            replaceLegacyMentions(
              html,
              (mention) => mentionIds.get(mentionSignature(mention)) || null,
            ),
          ),
        }
      : {}),
    relatedPosts: relatedPost
      ? [{ ref: relatedPost, model: relatedPostModel }]
      : [],
  };
}

// Old press entries record the medium in parenthetical ("Podcast", "Radio show", "in German").
// Language notes and anything unrecognized count as articles; parenthetical itself is kept.
export function pressKind(parenthetical) {
  const text = (parenthetical || '').toLowerCase();
  if (text.includes('podcast')) {
    return 'podcast';
  }
  if (text.includes('radio')) {
    return 'radio';
  }
  if (text.includes('television') || /\btv\b/.test(text)) {
    return 'tv';
  }
  if (text.includes('video')) {
    return 'video';
  }
  if (text === 'talk') {
    return 'talk';
  }
  return 'article';
}

export function transformPressEntry(doc) {
  return { ...doc, kind: pressKind(doc.parenthetical) };
}
