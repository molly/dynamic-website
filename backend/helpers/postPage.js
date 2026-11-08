import { DateTime } from 'luxon';
import { relatedUrls } from '../../api/micro.js';
import { PressEntry } from '../models/entry.model.js';
import { FeedEntry, FeedEntryMicro } from '../models/feed/feedEntry.model.js';
import { Thread } from '../models/thread.model.js';
import {
  FEED_ENTRY_LABEL_POPULATE,
  feedEntryHref,
  labelFeedEntry,
} from './feedEntries.js';
import {
  entryBlocks,
  entryMetadataUrls,
  extractUrlsFromBlocks,
} from './links.js';
import { loadArchives } from './postContext.js';

// What a post's own page shows beyond the feed: its threads in full, responses,
// press that drew on it, related entries, and the entries either side of it.

const ZONE = 'America/New_York';
const SITE = 'https://www.mollywhite.net';
const RELATED_LIMIT = 3;

const idOf = (value) => String(value?._id ?? value);
const isLive = (entry) => !(entry.__t === 'FeedEntryMicro' && !entry.micro);
const linkTo = (entry) => ({
  id: idOf(entry),
  label: labelFeedEntry(entry).label,
  href: feedEntryHref(entry),
  // Newsletter issues say so wherever they're listed (thread boxes, related)
  kind: entry.__t === 'FeedEntryCitationNeeded' ? 'Citation Needed' : null,
});

/**
 * Webmentions sorted for the page: replies and other responses with words ("From other
 * websites"), mentions ("Linked from"), and likes, reposts and bookmarks. Newest first.
 * @param {Object[]} webmentions
 */
export function sortWebmentions(webmentions = []) {
  const sorted = {
    replies: [],
    mentions: [],
    likes: [],
    reposts: [],
    bookmarks: [],
  };
  const approved = webmentions
    .filter((m) => m?.approved && m.body)
    .sort((a, b) =>
      String(b.body.published || '').localeCompare(
        String(a.body.published || ''),
      ),
    );
  for (const mention of approved) {
    const { type, content, summary } = mention.body;
    if (type === 'mention') {
      sorted.mentions.push(mention);
    } else if (content || summary) {
      sorted.replies.push(mention);
    } else if (type === 'like') {
      sorted.likes.push(mention);
    } else if (type === 'repost') {
      sorted.reposts.push(mention);
    } else if (type === 'bookmark') {
      sorted.bookmarks.push(mention);
    }
  }
  return sorted;
}

// The first entry after (or before) this one in the feed that's still on the site. Measured from
// the post's feed entry, which is saved a moment after the post itself.
async function neighbour({ _id, createdAt }, direction) {
  const candidates = await FeedEntry.find({
    _id: { $ne: _id },
    deletedAt: null,
    createdAt: direction === 'newer' ? { $gt: createdAt } : { $lt: createdAt },
  })
    .sort({ createdAt: direction === 'newer' ? 1 : -1 })
    .limit(5)
    .populate(FEED_ENTRY_LABEL_POPULATE)
    .lean();
  const found = candidates.find(isLive);
  return found ? linkTo(found) : null;
}

// Each titled thread with all its entries, oldest first.
async function threadBoxes(feedEntry) {
  const threads = await Thread.find(
    { _id: { $in: feedEntry.threads || [] }, title: { $nin: [null, ''] } },
    'title slug',
  ).lean();
  return Promise.all(
    threads.map(async (thread) => {
      const members = (
        await FeedEntry.find({ threads: thread._id, deletedAt: null })
          .sort({ createdAt: 1 })
          .populate(FEED_ENTRY_LABEL_POPULATE)
          .lean()
      ).filter(isLive);
      return {
        title: thread.title,
        slug: thread.slug,
        members: members.map((member) => ({
          ...linkTo(member),
          month: DateTime.fromJSDate(member.createdAt, { zone: ZONE }).toFormat(
            'yyyy-MM',
          ),
          current: idOf(member) === idOf(feedEntry),
        })),
      };
    }),
  );
}

/**
 * "Related": the entries chosen by hand, all of them in their order, then the stored automatic
 * matches (backend/helpers/related.js) up to RELATED_LIMIT in all, skipping entries already on the
 * page (the thread box and the newer and older links).
 * @param {Object} feedEntry With related and relatedAuto
 * @param {Set<string>} onPage Ids of entries the page already links to
 */
async function relatedEntries(feedEntry, onPage) {
  const manual = (feedEntry.related || []).map(idOf);
  const auto = (feedEntry.relatedAuto || []).map(({ entry }) => idOf(entry));
  const ids = [...new Set([...manual, ...auto])];
  if (!ids.length) {
    return [];
  }
  const found = (
    await FeedEntry.find({ _id: { $in: ids }, deletedAt: null })
      .populate(FEED_ENTRY_LABEL_POPULATE)
      .lean()
  ).filter(isLive);
  const byId = new Map(found.map((entry) => [idOf(entry), linkTo(entry)]));
  const chosen = manual.map((id) => byId.get(id)).filter(Boolean);
  for (const id of auto) {
    if (chosen.length >= RELATED_LIMIT) {
      break;
    }
    if (byId.has(id) && !onPage.has(id) && !manual.includes(id)) {
      chosen.push(byId.get(id));
    }
  }
  return chosen;
}

/**
 * Everything a micro post's page adds. Also sets `micro.pageMeta.archive` for the metadata column.
 * @param {Object} micro A hydrated micro entry, with feedMeta attached
 */
export async function loadPostPage(micro) {
  const feedEntry = await FeedEntryMicro.findOne(
    { micro: micro._id },
    '_id threads tags createdAt related relatedAuto',
  ).lean();
  const links = [
    ...new Set([
      ...extractUrlsFromBlocks(entryBlocks(micro)),
      ...entryMetadataUrls(micro),
      ...relatedUrls(micro),
    ]),
  ];
  const permalink = `${SITE}/micro/entry/${micro.slug}`;
  const [archived, threads, citedBy, newer, older] = await Promise.all([
    loadArchives([...links, permalink]),
    feedEntry ? threadBoxes(feedEntry) : [],
    feedEntry
      ? PressEntry.find({ drewOn: feedEntry._id }, 'title work href')
          .sort({ date: -1 })
          .lean()
      : [],
    neighbour(feedEntry || micro, 'newer'),
    neighbour(feedEntry || micro, 'older'),
  ]);
  const onPage = new Set(
    [
      ...threads.flatMap((thread) => thread.members.map((m) => m.id)),
      newer?.id,
      older?.id,
      feedEntry && idOf(feedEntry),
    ].filter(Boolean),
  );
  const related = feedEntry ? await relatedEntries(feedEntry, onPage) : [];
  micro.pageMeta = {
    archive: {
      page: archived[permalink] || null,
      archived: links.filter((url) => archived[url]).length,
      total: links.length,
    },
  };
  return {
    threads,
    citedBy,
    related,
    newer,
    older,
    responses: sortWebmentions(micro.webmentions || []),
  };
}
