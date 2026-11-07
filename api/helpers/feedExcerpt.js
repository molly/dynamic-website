// In the feed, a long post shows its start and then "continues →": its first two paragraphs and
// its first image or card. Each rendered block in `micro.html` lines up with a block of
// `micro.post.blocks`.

const TEXT_BLOCKS = new Set(['paragraph', 'header', 'list', 'quote']);

/**
 * The blocks a post shows in the feed, and whether some were left out.
 * @param {{post: {blocks: Object[]}, html: string[]}} micro A hydrated micro entry
 * @param {{texts?: number, cards?: number}} [limits]
 * @returns {{html: string[], truncated: boolean}}
 */
export function feedExcerpt(micro, { texts = 2, cards = 1 } = {}) {
  const blocks = micro.post?.blocks || [];
  const html = micro.html || [];
  const left = { text: texts, card: cards };
  const shown = [];
  for (const [index, block] of blocks.entries()) {
    if (!String(html[index] || '').trim()) {
      continue; // Renders as nothing, like the cross-posting delimiter
    }
    const kind = TEXT_BLOCKS.has(block.type) ? 'text' : 'card';
    if (left[kind] === 0) {
      return { html: shown, truncated: true };
    }
    left[kind] -= 1;
    shown.push(html[index]);
  }
  return { html: shown, truncated: false };
}
