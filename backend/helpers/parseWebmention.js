import { mf2 } from 'microformats-parser';

// mf2 u-* properties are plain strings, unless they're nested microformats
// (e.g. an h-cite), in which case they're objects with a value and/or url.
const propertyUrls = (values = []) =>
  values.flatMap((v) => {
    if (typeof v === 'string') {
      return [v];
    }
    return [v?.value, ...(v?.properties?.url ?? [])].filter(Boolean);
  });

const referencesTarget = (values, target) =>
  propertyUrls(values).some((url) => {
    try {
      return new URL(url).href === new URL(target).href;
    } catch {
      return false;
    }
  });

const findHEntry = (items) => {
  for (const item of items) {
    if (item.type?.includes('h-entry')) {
      return item;
    }
    const nested = findHEntry(item.children ?? []);
    if (nested) {
      return nested;
    }
  }
  return null;
};

const TYPE_PROPERTIES = [
  ['in-reply-to', 'reply'],
  ['like-of', 'like'],
  ['bookmark-of', 'bookmark'],
  ['repost-of', 'repost'],
];

// Extract display details for a webmention from the source page's HTML.
// Returns whatever can be found; `warning` is set if there's no h-entry, in
// which case details need to be filled in manually.
export const parseWebmentionSource = ({ html, source, target }) => {
  const parsed = mf2(html, { baseUrl: source });
  const result = { mentionUrl: source };
  const hEntry = findHEntry(parsed.items);

  if (!hEntry) {
    result.authorUrl = parsed.rels?.author?.[0];
    result.warning = 'No h-entry found on the source page.';
    return result;
  }

  const props = hEntry.properties;
  const author = props.author?.[0];
  if (typeof author === 'string') {
    // Author can be a plain name or URL instead of an h-card
    if (/^https?:\/\//.test(author)) {
      result.authorUrl = author;
    } else {
      result.author = author;
    }
  } else if (author) {
    result.author = author.properties?.name?.[0];
    result.authorUrl = author.properties?.url?.[0];
  }
  if (!result.authorUrl) {
    result.authorUrl = parsed.rels?.author?.[0];
  }

  result.published = props.published?.[0];
  result.content = props.content?.[0]?.html;
  result.summary = props.summary?.[0];

  for (const [property, type] of TYPE_PROPERTIES) {
    if (referencesTarget(props[property], target)) {
      result.type = type;
    }
  }

  return result;
};
