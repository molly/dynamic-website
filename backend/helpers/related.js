import {
  documentFrequencies,
  rankRelated,
} from '../../api/helpers/relatedScore.js';
import { FeedEntry } from '../models/feed/feedEntry.model.js';
import logger from '../winston.js';

// Works out each post's related entries and stores them on its feed entry (relatedAuto), so post
// pages don't score anything when they load. Run for a post and everything sharing a tag or
// entity with it whenever it's saved, and for every post by backend/scripts/rebuildRelated.js.

// Entries that can be related: posts, newsletter issues and press. Not reading or books.
const RELATED_TYPES = [
  'FeedEntryMicro',
  'FeedEntryCitationNeeded',
  'FeedEntryPress',
];

const idOf = (value) => String(value?._id ?? value);

/** Every entry that can be related, with what scoring needs. */
export function loadRelatedIndex() {
  return FeedEntry.find(
    { __t: { $in: RELATED_TYPES }, deletedAt: null },
    '_id __t tags about threads createdAt',
  ).lean();
}

/**
 * Score and store related entries for these posts.
 * @param {string[]} postIds Feed entry ids of posts (FeedEntryMicro)
 * @param {Object[]} [index] From loadRelatedIndex, when already loaded
 * @returns {Promise<number>} How many posts were updated
 */
export async function refreshRelated(postIds, index) {
  const entries = index || (await loadRelatedIndex());
  const frequencies = documentFrequencies(entries);
  const wanted = new Set(postIds.map(idOf));
  const operations = entries
    .filter(
      (entry) => entry.__t === 'FeedEntryMicro' && wanted.has(idOf(entry)),
    )
    .map((post) => ({
      updateOne: {
        filter: { _id: post._id },
        update: {
          $set: { relatedAuto: rankRelated(post, entries, frequencies) },
        },
        // Don't bump updatedAt or regenerate RSS for a list that only the post page reads.
        timestamps: false,
      },
    }));
  if (operations.length) {
    await FeedEntry.bulkWrite(operations);
  }
  return operations.length;
}

/**
 * After a post is saved: refresh it and every post that shares a tag or entity with it, since its
 * new tags or wording can change their best matches too.
 * @param {string} feedEntryId
 */
export async function refreshRelatedAround(feedEntryId) {
  const index = await loadRelatedIndex();
  const saved = index.find((entry) => idOf(entry) === idOf(feedEntryId));
  if (!saved) {
    return 0;
  }
  const features = new Set(
    [...(saved.tags || []), ...(saved.about || [])].map(idOf),
  );
  const affected = index.filter(
    (entry) =>
      entry.__t === 'FeedEntryMicro' &&
      [...(entry.tags || []), ...(entry.about || [])].some((id) =>
        features.has(idOf(id)),
      ),
  );
  return refreshRelated(
    [saved._id, ...affected.map((entry) => entry._id)],
    index,
  );
}

/**
 * Run refreshRelatedAround without holding up a response. A failure is logged; the next save
 * or rebuild fills the lists in.
 * @param {string} feedEntryId
 */
export function refreshRelatedInBackground(feedEntryId) {
  refreshRelatedAround(feedEntryId).catch((err) =>
    logger.error('Failed to refresh related entries', err),
  );
}

/** Every post's related entries. */
export async function rebuildAllRelated() {
  const index = await loadRelatedIndex();
  return refreshRelated(
    index
      .filter((entry) => entry.__t === 'FeedEntryMicro')
      .map((entry) => entry._id),
    index,
  );
}
