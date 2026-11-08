// The numbered pager under a feed or list: "← newer   1 2 3 … 35   older →"
// (pug/includes/pager.pug).

/**
 * The page numbers to show: the first and last, the current one and its neighbours, and enough at
 * either end that the start and end read as runs ("1 2 3 … 35", "1 … 33 34 35"). null marks a gap.
 * A gap of one page shows that page rather than "…".
 * @param {number} current
 * @param {number} total
 * @returns {(number|null)[]}
 */
export function pagerItems(current, total) {
  if (total < 1) {
    return [];
  }
  const shown = new Set([1, total, current - 1, current, current + 1]);
  if (current <= 3) {
    [2, 3].forEach((page) => shown.add(page));
  }
  if (current >= total - 2) {
    [total - 1, total - 2].forEach((page) => shown.add(page));
  }
  const pages = [...shown]
    .filter((page) => page >= 1 && page <= total)
    .sort((a, b) => a - b);
  const items = [];
  for (const page of pages) {
    const previous = items.at(-1);
    if (previous !== undefined && page - previous === 2) {
      items.push(page - 1);
    } else if (previous !== undefined && page - previous > 2) {
      items.push(null);
    }
    items.push(page);
  }
  return items;
}
