// Filters for the redesigned lists (press, the reading lists) as plain links, so the pages need no
// script. Filters live in the URL: tags (values joined with "-"), search, order ("reverse" for
// oldest first), page, and whatever else a list adds (a book's status and type).

/**
 * A list's URL with these filters, leaving out empty ones and page 1. Parameters keep the order
 * given.
 * @param {string} path
 * @param {Object<string, string|number|string[]>} params
 * @returns {string}
 */
export function listHref(path, params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const text = Array.isArray(value) ? value.join('-') : String(value ?? '');
    if (!text || (key === 'page' && Number(value) <= 1)) {
      continue;
    }
    query.set(key, text);
  }
  const search = query.toString();
  return search ? `${path}?${search}` : path;
}

/** A tag as the site writes it: "#crypto-lobby". */
export const tagText = (tag) =>
  `#${tag.text.trim().toLowerCase().replace(/\s+/g, '-')}`;

/**
 * Each tag with its count, whether it's chosen, its share of the most used tag's count (for bars),
 * and a link to the list with it added or, when chosen, taken away.
 * @param {Object[]} allTags Tags, most used first
 * @param {string[]} chosen Values of the chosen tags
 * @param {{count: (tag: Object) => number, href: (tags: string[]) => string}} options
 * @returns {{value: string, text: string, count: number, share: number, current: boolean,
 *   href: string}[]}
 */
export function tagChips(allTags, chosen, { count, href }) {
  const counts = allTags.map((tag) => count(tag) || 0);
  const most = Math.max(1, ...counts);
  return allTags.map((tag, index) => {
    const current = chosen.includes(tag.value);
    return {
      value: tag.value,
      text: tag.text,
      count: counts[index],
      share: counts[index] / most,
      current,
      href: href(
        current
          ? chosen.filter((value) => value !== tag.value)
          : [...chosen, tag.value],
      ),
    };
  });
}

/**
 * The first few chips, and any chosen one, to show; the rest behind "more".
 * @param {Object[]} chips From tagChips
 * @param {number} visible
 * @returns {{shown: Object[], more: Object[]}}
 */
export function splitChips(chips, visible) {
  const shown = chips.filter((chip, index) => index < visible || chip.current);
  return { shown, more: chips.filter((chip) => !shown.includes(chip)) };
}
