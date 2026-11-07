import { FeedEntry } from '../models/feed/feedEntry.model.js';
import { Thread } from '../models/thread.model.js';
import { FEED_ENTRY_LABEL_POPULATE, labelFeedEntry } from './feedEntries.js';

/**
 * All threads with their entry counts, most recently updated first.
 */
export async function listThreads() {
  const [threads, counts] = await Promise.all([
    Thread.find({}, 'title slug description updatedAt')
      .sort({ updatedAt: -1 })
      .lean(),
    FeedEntry.aggregate([
      { $match: { 'threads.0': { $exists: true }, deletedAt: null } },
      { $unwind: '$threads' },
      { $group: { _id: '$threads', count: { $sum: 1 } } },
    ]),
  ]);
  const countById = new Map(counts.map((c) => [c._id.toString(), c.count]));
  return threads.map((thread) => ({
    ...thread,
    count: countById.get(thread._id.toString()) || 0,
  }));
}

/**
 * A thread's entries in order (oldest first), labelled, with links to their editors.
 * @param {import('mongoose').Types.ObjectId|string} threadId
 */
export async function threadEntries(threadId) {
  const entries = await FeedEntry.find({ threads: threadId, deletedAt: null })
    .sort({ createdAt: 1 })
    .populate(FEED_ENTRY_LABEL_POPULATE)
    .lean();
  return entries.map(labelFeedEntry);
}
