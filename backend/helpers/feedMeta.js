import { ArchivedLink } from '../models/archivedLink.model.js';
import { Book } from '../models/book.model.js';
import { Entity } from '../models/entity.model.js';
import { FeedEntry, FeedEntryMicro } from '../models/feed/feedEntry.model.js';
import { Thread } from '../models/thread.model.js';
import { ENTITY_SUMMARY_FIELDS } from './entities.js';
import {
  FEED_ENTRY_LABEL_POPULATE,
  feedEntryHref,
  labelFeedEntry,
} from './feedEntries.js';
import { escapeHtml } from '../../api/helpers/html.js';
import { renderMention } from './mentionMarkup.js';

// What the metadata column needs beyond an entry itself: its threads and their neighbours, the
// entities it's about, and Wayback copies of its links. Loaded once per page, for every entry on
// it, and attached as `entry.feedMeta` for entryMeta (api/helpers/entryMeta.js) to read.

const SITE = 'https://www.mollywhite.net';

const idOf = (value) => String(value?._id ?? value);

// A later newsletter issue, for the "Followed up in Citation Needed" card.
const issueCard = (entry) => ({
  ...neighbour(entry),
  title: entry.title,
  image: entry.image || null,
  imageAlt: entry.imageAlt || '',
  dek: String(entry.excerpt || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim(),
  createdAt: entry.createdAt,
});

// A neighbouring entry as the column shows it.
const neighbour = (entry) =>
  entry
    ? { label: labelFeedEntry(entry).label, href: feedEntryHref(entry) }
    : null;

/**
 * Each entry's feed entry: itself on the feed, or the FeedEntryMicro of a micro post shown on its
 * own (micro pages), which carries the post's threads and about.
 */
async function feedEntriesFor(entries) {
  const microIds = entries
    .filter((entry) => !entry.__t?.startsWith('FeedEntry') && entry.slug)
    .map((entry) => entry._id);
  const microFeedEntries = microIds.length
    ? await FeedEntryMicro.find(
        { micro: { $in: microIds } },
        '_id micro threads about createdAt',
      ).lean()
    : [];
  const byMicro = new Map(microFeedEntries.map((f) => [idOf(f.micro), f]));
  return entries.map((entry) =>
    entry.__t?.startsWith('FeedEntry')
      ? entry
      : byMicro.get(idOf(entry)) || null,
  );
}

/**
 * Every member of these threads, oldest first, by thread id.
 * @param {string[]} threadIds
 */
async function threadMembers(threadIds) {
  const members = await FeedEntry.find({
    threads: { $in: threadIds },
    deletedAt: null,
  })
    .sort({ createdAt: 1 })
    .populate(FEED_ENTRY_LABEL_POPULATE)
    .lean();
  const byThread = new Map(threadIds.map((id) => [id, []]));
  for (const member of members) {
    if (member.__t === 'FeedEntryMicro' && !member.micro) {
      continue; // Its post was deleted
    }
    for (const thread of member.threads) {
      byThread.get(idOf(thread))?.push(member);
    }
  }
  return byThread;
}

// The book before this one in its series, among the books you've logged.
function previousInSeries(book, seriesBooks) {
  if (!book?.series || !Number.isFinite(book.seriesNumber)) {
    return null;
  }
  const earlier = seriesBooks
    .filter(
      (b) =>
        b.series === book.series &&
        Number.isFinite(b.seriesNumber) &&
        b.seriesNumber < book.seriesNumber,
    )
    .sort((a, b) => b.seriesNumber - a.seriesNumber)[0];
  return earlier
    ? {
        label: earlier.title,
        href: `/reading/books?search=${encodeURIComponent(earlier.title)}`,
      }
    : null;
}

// The permalink of a post, as archived.
const permalinkOf = (entry) => {
  const slug = entry.micro?.slug || (entry.post && entry.slug);
  return slug ? `${SITE}/micro/entry/${slug}` : null;
};

/**
 * Attach `feedMeta` to each entry: { threads, previous, next, laterIssues, about, archived,
 * previousInSeries }.
 *  - threads: titled threads, each { title, slug, position, total }
 *  - previous/next/laterIssues: from the entry's first thread (titled or not), by date
 *  - about: [{ name, html }], html being the name with its account links
 *  - archived: { [url]: archiveUrl } for a post's permalink, a press piece's or an article's link
 *  - previousInSeries: for a book, the one before it in its series
 * @param {Object[]} entries Hydrated feed entries, or micro entries on their own
 */
export async function attachFeedMeta(entries) {
  const feedEntries = await feedEntriesFor(entries);
  const threadIds = [
    ...new Set(feedEntries.flatMap((f) => (f?.threads || []).map(idOf))),
  ];
  const aboutIds = [
    ...new Set(feedEntries.flatMap((f) => (f?.about || []).map(idOf))),
  ];
  const linksOf = (entry) =>
    [permalinkOf(entry), entry.press?.href, entry.shortform?.href].filter(
      Boolean,
    );
  const urls = entries.flatMap(linksOf);
  const series = [
    ...new Set(entries.map((entry) => entry.book?.series).filter(Boolean)),
  ];

  const [threads, members, entities, archivedLinks, seriesBooks] =
    await Promise.all([
      threadIds.length
        ? Thread.find({ _id: { $in: threadIds } }, 'title slug').lean()
        : [],
      threadIds.length ? threadMembers(threadIds) : new Map(),
      aboutIds.length
        ? Entity.find(
            { _id: { $in: aboutIds } },
            `${ENTITY_SUMMARY_FIELDS} slug`,
          ).lean()
        : [],
      urls.length
        ? ArchivedLink.find(
            { url: { $in: urls }, status: 'ok' },
            'url archiveUrl',
          ).lean()
        : [],
      series.length
        ? Book.find(
            { series: { $in: series } },
            'title series seriesNumber',
          ).lean()
        : [],
    ]);
  const threadsById = new Map(threads.map((t) => [idOf(t), t]));
  const entitiesById = new Map(entities.map((e) => [idOf(e), e]));
  const archived = Object.fromEntries(
    archivedLinks.map((link) => [link.url, link.archiveUrl]),
  );

  entries.forEach((entry, index) => {
    const feedEntry = feedEntries[index];
    const meta = {
      key: idOf(entry),
      threads: [],
      previous: null,
      next: null,
      laterIssues: [],
      about: [],
    };
    for (const [n, threadId] of (feedEntry?.threads || [])
      .map(idOf)
      .entries()) {
      const thread = threadsById.get(threadId);
      const list = members.get(threadId) || [];
      const position = list.findIndex((m) => idOf(m) === idOf(feedEntry));
      if (!thread || position < 0) {
        continue;
      }
      if (thread.title && thread.slug) {
        meta.threads.push({
          title: thread.title,
          slug: thread.slug,
          position: position + 1,
          total: list.length,
        });
      }
      if (n === 0) {
        meta.previous = neighbour(list[position - 1]);
        meta.next = neighbour(list[position + 1]);
        meta.laterIssues = list
          .slice(position + 1)
          .filter((m) => m.__t === 'FeedEntryCitationNeeded')
          .map(issueCard);
      }
    }
    meta.about = (feedEntry?.about || [])
      .map((id) => entitiesById.get(idOf(id)))
      .filter(Boolean)
      .map((entity) => ({
        name: entity.name,
        html: renderMention(entity, escapeHtml(entity.name)),
      }));
    meta.archived = Object.fromEntries(
      linksOf(entry)
        .filter((url) => archived[url])
        .map((url) => [url, archived[url]]),
    );
    meta.previousInSeries = previousInSeries(entry.book, seriesBooks);
    entry.feedMeta = meta;
  });
  return entries;
}
