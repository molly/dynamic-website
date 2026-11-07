import { Book } from '../models/book.model.js';
import { Entity } from '../models/entity.model.js';
import { PressEntry, ShortformEntry } from '../models/entry.model.js';
import MicroEntry from '../models/micro/microEntry.model.js';
import { Tag } from '../models/tag.model.js';
import { Thread } from '../models/thread.model.js';
import { ENTITY_SUMMARY_FIELDS } from './entities.js';

// Populate options for labelFeedEntry, for any mix of feed entry types.
export const FEED_ENTRY_LABEL_POPULATE = [
  { path: 'micro', model: MicroEntry, select: 'title slug post' },
  { path: 'shortform', model: ShortformEntry, select: 'title' },
  { path: 'book', model: Book, select: 'title' },
  { path: 'press', model: PressEntry, select: 'title' },
];

const LABEL_LENGTH = 80;

function truncate(text) {
  return text.length > LABEL_LENGTH
    ? `${text.slice(0, LABEL_LENGTH - 1).trimEnd()}…`
    : text;
}

// Most micro posts are untitled, so fall back to the start of their first text block.
function microLabel(micro) {
  if (micro.title) {
    return micro.title;
  }
  const textBlock = micro.post?.blocks?.find((block) => block.data?.text);
  if (!textBlock) {
    return 'Untitled post';
  }
  return textBlock.data.text
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * A short human-readable label for a feed entry populated with FEED_ENTRY_LABEL_POPULATE.
 * @param {Object} entry
 * @returns {{ _id: string, type: string, label: string, createdAt: Date }}
 */
export function labelFeedEntry(entry) {
  let label;
  if (entry.micro) {
    label = microLabel(entry.micro);
  } else if (entry.title) {
    label = entry.title; // Citation Needed issue
  } else {
    label =
      entry.shortform?.title ||
      entry.book?.title ||
      entry.press?.title ||
      'Untitled entry';
  }
  return {
    _id: entry._id,
    type: entry.__t,
    label: truncate(label),
    createdAt: entry.createdAt,
  };
}

/**
 * Populate the fields the tagger page edits: tags, threads and about.
 * @param {import('mongoose').Document} feedEntry
 */
export function populateTaggerFields(feedEntry) {
  return feedEntry.populate([
    { path: 'tags', model: Tag, options: { sort: { value: 1 } } },
    { path: 'threads', model: Thread, select: 'title slug' },
    { path: 'about', model: Entity, select: ENTITY_SUMMARY_FIELDS },
  ]);
}
