import { DateTime } from 'luxon';
import { listHref, splitChips, tagChips } from './listFilters.js';

// The press page (/press): its filters as links, its tag chips, and its entries by month. Filters
// live in the URL, as they always have: tags (values joined with "-"), search, order ("reverse" for
// oldest first) and page.

// Tags shown as chips before "+ n more tags"
export const VISIBLE_TAGS = 10;

/**
 * The press page with these filters.
 * @param {{tags?: string[], search?: string, order?: string, page?: number}} filters
 * @returns {string}
 */
export const pressHref = ({
  tags = [],
  search = '',
  order = '',
  page = 1,
} = {}) =>
  listHref('/press', {
    tags,
    search,
    order: order === 'reverse' ? 'reverse' : '',
    page,
  });

/**
 * The tag chips: the most used, then the rest behind "+ n more tags". A chosen tag is always
 * shown. Each links to the page with that tag added or, when chosen, taken away.
 * @param {Object[]} allTags Tags used on press, most used first, with frequency.press
 * @param {{tags: string[], search?: string, order?: string}} query
 * @returns {{shown: Object[], more: Object[]}}
 */
export const pressTagChips = (allTags, query) =>
  splitChips(
    tagChips(allTags, query.tags, {
      count: (tag) => tag.frequency?.press,
      href: (tags) => pressHref({ ...query, tags }),
    }),
    VISIBLE_TAGS,
  );

/**
 * Press entries under a heading for each month ("November 2026"), or year for those dated only
 * by year, in the order given. Each row gets its day ("Nov 5"), when it has one.
 * @param {{date: string}[]} results
 * @returns {{key: string, label: string, rows: Object[]}[]}
 */
export function groupPressByMonth(results) {
  const groups = [];
  for (const article of results) {
    const date = String(article.date || '');
    const key = date.slice(0, date.length >= 7 ? 7 : 4);
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      group = {
        key,
        label:
          key.length === 7
            ? DateTime.fromISO(key).toFormat('LLLL yyyy')
            : key || 'Undated',
        rows: [],
      };
      groups.push(group);
    }
    group.rows.push({
      ...article,
      dayLabel: /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? DateTime.fromISO(date).toFormat('LLL d')
        : null,
    });
  }
  return groups;
}
