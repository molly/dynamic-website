// The filter chips above the feed. Each narrows the feed to one kind of entry.

export const FEED_FILTERS = [
  {
    value: 'posts',
    label: 'posts',
    icon: 'chat',
    query: { __t: 'FeedEntryMicro' },
  },
  {
    value: 'newsletter',
    label: 'newsletter',
    icon: 'envelope',
    query: { __t: 'FeedEntryCitationNeeded' },
  },
  {
    value: 'reading',
    label: 'reading',
    icon: 'newspaper',
    query: { __t: 'FeedEntryReading', shortform: { $exists: true } },
  },
  {
    value: 'books',
    label: 'books',
    icon: 'book',
    query: { __t: 'FeedEntryReading', book: { $exists: true } },
  },
  {
    value: 'press',
    label: 'press',
    icon: 'quote',
    query: { __t: 'FeedEntryPress' },
  },
];

/**
 * The query for a filter chip's value; everything for no value or an unknown one.
 * @param {string} [value]
 * @returns {{filter: ?Object, query: Object}}
 */
export function feedFilter(value) {
  const filter = FEED_FILTERS.find((f) => f.value === value) || null;
  return { filter, query: filter ? filter.query : {} };
}
