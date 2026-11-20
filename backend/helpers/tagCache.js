import { BookTag, Tag } from '../models/tag.model.js';

// Tags and book tags, kept in memory. Most pages need every tag (the tags beside the reading lists
// and press, a book's tags on the feed), and they change only when an entry is saved, so loading
// them from the database for every page is wasted work.
//
// Saving tags through helpers/tags.js clears the cache, so the site shows the change on the next
// request. Other processes (the scripts in backend/scripts that recount tags) can't clear this
// process's cache, so it also expires after MAX_AGE.

const MAX_AGE = 5 * 60 * 1000;

const cache = new Map(); // model name → { loaded: Promise<Object[]>, at: number }

function load(model) {
  const cached = cache.get(model.modelName);
  if (cached && Date.now() - cached.at < MAX_AGE) {
    return cached.loaded;
  }
  // exec(): a promise, which every caller can share. A query runs again each time it's awaited.
  const loaded = model.find({}, { __v: 0 }).lean().exec();
  const entry = { loaded, at: Date.now() };
  cache.set(model.modelName, entry);
  // Don't keep a failed load: the next request tries again.
  loaded.catch(() => {
    if (cache.get(model.modelName) === entry) {
      cache.delete(model.modelName);
    }
  });
  return loaded;
}

// Copies, so a caller changing a tag doesn't change it for every later request.
const copies = (tags) =>
  tags.map((tag) => ({
    ...tag,
    ...(tag.frequency ? { frequency: { ...tag.frequency } } : {}),
  }));

/**
 * Every tag (or book tag).
 * @param {{book?: boolean}} [options]
 * @returns {Promise<Object[]>}
 */
export async function getAllTags({ book = false } = {}) {
  return copies(await load(book ? BookTag : Tag));
}

/**
 * The tags used in a category, most used first, as `frequency[category]` counts them: for tags,
 * 'shortform', 'press', 'micro', …; for book tags, 'total'.
 * @param {string} category
 * @param {{book?: boolean}} [options]
 * @returns {Promise<Object[]>}
 */
export async function getTagsByFrequency(category, { book = false } = {}) {
  const count = (tag) => tag.frequency?.[category] ?? 0;
  return (await getAllTags({ book }))
    .filter((tag) => count(tag) > 0)
    .sort((a, b) => count(b) - count(a));
}

/**
 * The tags with these values (as in URLs: "machine_learning").
 * @param {string[]} values
 * @param {{book?: boolean}} [options]
 * @returns {Promise<Object[]>}
 */
export async function getTagsByValue(values, { book = false } = {}) {
  const wanted = new Set(values);
  return (await getAllTags({ book })).filter((tag) => wanted.has(tag.value));
}

/** Forget the cached tags, after they've changed. */
export function invalidateTagCache() {
  cache.clear();
}
