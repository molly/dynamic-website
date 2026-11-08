import express from 'express';
import { FEED_PAGE_SIZE, feedPageOf, getFeedEntries } from '../../api/feed.js';
import { shortDate } from '../../api/helpers/entryMeta.js';
import { FEED_FILTERS, feedFilter } from '../../api/helpers/feedFilters.js';
import {
  PRESS_CARD_FIELDS,
  PRESS_ENTITY_FIELDS,
  PRESS_KINDS,
  PRESS_ROLES,
  PressEntry,
  ShortformEntry,
} from '../../backend/models/entry.model.js';
import {
  FeedEntryCitationNeeded,
  FeedEntryPress,
  FeedEntryReading,
} from '../../backend/models/feed/feedEntry.model.js';
import { ENTITY_SUMMARY_FIELDS } from '../../backend/helpers/entities.js';
import { populateTaggerFields } from '../../backend/helpers/feedEntries.js';
import { Entity } from '../../backend/models/entity.model.js';
import { attachFeedMeta } from '../../backend/helpers/feedMeta.js';
import { Thread } from '../../backend/models/thread.model.js';
import { Tag } from '../../backend/models/tag.model.js';
import { authenticated } from '../../backend/routes/auth.js';
import { sanitizeTag } from '../js/helpers/sanitize.js';

const router = express.Router();
const LIMIT = FEED_PAGE_SIZE;

const pageNumber = (value) => Math.max(1, parseInt(value, 10) || 1);

router.get('/', async function (req, res) {
  const page = pageNumber(req.query.page);
  const { filter, query } = feedFilter(req.query.type);
  const result = await getFeedEntries({
    query,
    start: (page - 1) * LIMIT,
    limit: LIMIT,
  });

  await attachFeedMeta(result.entries);
  res.render('feed/index.pug', {
    entries: result.entries,
    currentPage: page,
    totalPages: Math.ceil(result.totalResults / LIMIT),
    filters: FEED_FILTERS,
    activeFilter: filter?.value || null,
    options: { isInFeed: true, isLoggedIn: req.isAuthenticated() },
  });
});

// Tag feed
router.get('/tag/:tag', async (req, res) => {
  const page = pageNumber(req.query.page);
  const start = (page - 1) * LIMIT;
  const sanitizedTag = sanitizeTag(req.params.tag);
  const tag = await Tag.findOne({ value: sanitizedTag });
  let hasResults = false;
  const results = {
    currentPage: page,
    pageSize: LIMIT,
    entries: [],
    totalPages: 0,
    totalResults: 0,
    totalUnfilteredResults: 0,
  };
  if (tag) {
    hasResults = true;
    const result = await getFeedEntries({
      query: { tags: tag._id },
      start,
      limit: LIMIT,
    });
    results.entries = await attachFeedMeta(result.entries);
    results.totalPages = Math.ceil(result.totalResults / LIMIT);
    results.totalResults = result.totalResults;
    results.totalUnfilteredResults = result.totalUnfilteredResults;
  }
  res.render('feed/index.pug', {
    ...results,
    options: {
      isInFeed: true,
      isLoggedIn: req.isAuthenticated(),
      tag: tag,
      tagQuery: sanitizedTag,
      hasResults,
    },
  });
});

// A thread: its entries in the order they happened.
const THREAD_LIMIT = 50;
router.get('/thread/:slug', async (req, res) => {
  const thread = await Thread.findOne({ slug: String(req.params.slug) }).lean();
  if (!thread) {
    res.status(404).render('404.pug');
    return;
  }
  const page = pageNumber(req.query.page);
  const result = await getFeedEntries({
    query: { threads: thread._id },
    start: (page - 1) * THREAD_LIMIT,
    limit: THREAD_LIMIT,
    oldestFirst: true,
  });
  await attachFeedMeta(result.entries);
  res.render('feed/thread.pug', {
    thread,
    entries: result.entries,
    totalResults: result.totalResults,
    currentPage: page,
    totalPages: Math.ceil(result.totalResults / THREAD_LIMIT),
    options: { isInFeed: true, isLoggedIn: req.isAuthenticated() },
  });
});

// The press card fields the tagger edits, as the form shows them.
function pressCardFields(press) {
  return Object.fromEntries(
    PRESS_CARD_FIELDS.map((field) => [field, press?.[field] ?? null]),
  );
}

// Metadata editor for feed entries that aren't micro posts: tags, threads, about
const PRESS_KIND_NAMES = {
  article: 'Article',
  podcast: 'Podcast',
  radio: 'Radio',
  video: 'Video',
  tv: 'TV',
  talk: 'Talk',
  freelance: 'Freelance (I wrote it)',
};

/**
 * What the tagger shows of the entry it's tagging, like the head of an editor: what kind of entry
 * it is, its title (linked to the original), where it's from, when it was added, and its summary.
 * source: [{ text, italic }], a publication's name in italics. blurb: HTML you wrote or the
 * newsletter's excerpt.
 * @param {Object} entry A plain feed entry, its shortform or press populated
 * @param {string} entryType
 */
function taggerHeader(entry, entryType) {
  const added = `added ${shortDate(entry.createdAt)}`;
  if (entryType === 'citationNeeded') {
    return {
      label: 'Citation Needed issue',
      kind: 'issue',
      title: entry.title,
      href: `https://www.citationneeded.news/${entry.slug}`,
      source: [{ text: 'Citation Needed', italic: true }, { text: added }],
      blurb: entry.excerpt || null,
    };
  }
  if (entryType === 'readingShortform') {
    const article = entry.shortform || {};
    return {
      label: 'Reading',
      kind: 'reading',
      title: article.title,
      href: article.href,
      source: [
        article.author ? { text: article.author } : null,
        article.work
          ? { text: article.work, italic: article.workItalics !== false }
          : null,
        article.publisher ? { text: article.publisher } : null,
        { text: added },
      ].filter(Boolean),
      blurb: article.summary || null,
    };
  }
  const press = entry.press || {};
  return {
    label: `Press · ${PRESS_KIND_NAMES[press.kind] || press.kind || 'piece'}`,
    kind: 'press',
    title: press.title,
    href: press.href,
    source: [
      press.work ? { text: press.work, italic: true } : null,
      { text: added },
    ].filter(Boolean),
    blurb: null,
  };
}

const TAGGER_MODELS = {
  citationNeeded: FeedEntryCitationNeeded,
  readingShortform: FeedEntryReading,
  press: FeedEntryPress,
};

router.get(
  '/tagger/:type/:id',
  authenticated({ redirectTo: '/micro/login' }),
  async (req, res) => {
    const entryType = req.params.type;
    if (entryType === 'micro') {
      res.status(400).send('Use the micro editor.');
      return;
    }
    const Model = TAGGER_MODELS[entryType];
    if (!Model) {
      res.status(400).send(`Unknown entry type "${entryType}".`);
      return;
    }
    const entry = await Model.findById(req.params.id);
    if (!entry) {
      res.sendStatus(404);
      return;
    }
    await populateTaggerFields(entry);
    if (entryType === 'readingShortform') {
      await entry.populate({ path: 'shortform', model: ShortformEntry });
    } else if (entryType === 'press') {
      await entry.populate({
        path: 'press',
        model: PressEntry,
        populate: PRESS_ENTITY_FIELDS.map((path) => ({
          path,
          model: Entity,
          select: ENTITY_SUMMARY_FIELDS,
        })),
      });
    }
    const pickerData = {
      feedEntryId: entry._id,
      entryType,
      createdAt: entry.createdAt,
      threads: entry.threads.map((t) => t.toJSON()),
      about: entry.about.map((e) => e.toJSON()),
      // Who wrote or hosted it, and the others in a talk or appearance, for the press card's
      // pickers
      pressAuthors:
        entryType === 'press'
          ? (entry.press?.authors || []).map((e) => e.toJSON())
          : [],
      pressPeople:
        entryType === 'press'
          ? (entry.press?.people || []).map((e) => e.toJSON())
          : [],
    };
    const header = taggerHeader(entry.toObject(), entryType);
    const page = await feedPageOf(entry);
    res.render('feed/tagger.pug', {
      title: header.title || 'Tagger',
      adminPage: 'tagger',
      header,
      // "← all posts" goes back to the page of the feed the entry is on
      feedHref: page > 1 ? `/feed?page=${page}` : '/feed',
      entry: entry.toObject(),
      entryType,
      pickerData,
      press: entryType === 'press' ? pressCardFields(entry.press) : null,
      pressKinds: PRESS_KINDS,
      pressKindNames: PRESS_KIND_NAMES,
      pressRoles: PRESS_ROLES,
    });
  },
);

// RSS
router.get('/feed.xml', (_, res) => {
  res.sendFile(new URL('../../rss/feedFeed.xml', import.meta.url).pathname);
});

export default router;
