import { DateTime } from 'luxon';
import { getPressDetails, isUpcoming } from './press.js';

// The metadata column beside each entry on the redesigned pages: an icon, a verb and a linked date,
// then label/value rows. Rows are left out when they'd be empty.
// Row: { label, items: [{ text, href?, italic? }], separator? }

const ZONE = 'America/New_York';
const BOOK_VERBS = {
  read: 'Finished',
  currentlyReading: 'Started',
  dnf: 'Stopped',
  reference: 'Referenced',
};

function toDateTime(date) {
  if (date instanceof Date) {
    return DateTime.fromJSDate(date, { zone: ZONE });
  }
  return DateTime.fromISO(String(date), { zone: ZONE });
}

/**
 * "Nov 5, 2:53 pm", with the year when it isn't this year: "Oct 1, 2024, 2:38 pm". Eastern time.
 * @param {Date|string} date
 * @param {{now?: DateTime}} [options]
 */
export function shortDateTime(date, { now = DateTime.now() } = {}) {
  const dt = toDateTime(date);
  const sameYear = dt.year === now.setZone(ZONE).year;
  const time = dt.toFormat('h:mm a').toLowerCase();
  return `${dt.toFormat(sameYear ? 'LLL d' : 'LLL d, yyyy')}, ${time}`;
}

/**
 * "Nov 4", with the year when it isn't this year. Plain dates ("2026-10-16") are read as written.
 * @param {Date|string} date
 * @param {{now?: DateTime}} [options]
 */
export function shortDate(date, { now = DateTime.now() } = {}) {
  const dt =
    typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? DateTime.fromISO(date, { zone: ZONE })
      : toDateTime(date);
  return dt.toFormat(
    dt.year === now.setZone(ZONE).year ? 'LLL d' : 'LLL d, yyyy',
  );
}

// "Thursday, October 30, 2026 · 6:11 pm ET", at the top of a post's page.
const fullDateTime = (date) => {
  const dt = toDateTime(date);
  return `${dt.toFormat('cccc, LLLL d, yyyy')} · ${dt.toFormat('h:mm a').toLowerCase()} ET`;
};

const fullTime = (date) =>
  toDateTime(date).toLocaleString(DateTime.DATETIME_FULL);

const tagText = (tag) =>
  `#${tag.text.trim().toLowerCase().replace(/\s+/g, '-')}`;

// Tags; on a post's page each with how many entries have it.
function tagsRow(tags, tagBase, { counts = false } = {}) {
  const valid = (tags || []).filter((tag) => tag && tag.text);
  return valid.length
    ? {
        label: 'tags',
        separator: ' ',
        items: valid.map((tag) => ({
          text: tagText(tag),
          href: `${tagBase}/${tag.value}`,
          ...(counts && Number.isFinite(tag.frequency?.total)
            ? { count: tag.frequency.total }
            : {}),
        })),
      }
    : null;
}

// Rows appear in this order, whichever kind of entry they belong to.
const ROW_ORDER = [
  'permalink',
  'updated',
  'from',
  'to',
  'quoting',
  'in',
  'event',
  'show',
  'length',
  'drew on',
  'started',
  'series',
  'sources',
  'data',
  'thread',
  'previously',
  'next',
  'later',
  'about',
  'tags',
  'also in',
  'discuss',
  'links',
  'archived',
];

const SITE = 'https://www.mollywhite.net';
const UPDATE_WORDS = { update: 'update', correction: 'correction' };
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const row = (label, items, extra = {}) =>
  items.length ? { label, items, ...extra } : null;

// A post that's only quotes, with no words of your own, is "Quoted".
const isQuoteOnly = (micro) => {
  const blocks = micro.post?.blocks || [];
  return blocks.length > 0 && blocks.every((block) => block.type === 'quote');
};

// "updated Oct 31 · 1 update, 1 correction", or "updates 3" on a live post.
function updatesRow(micro, href, options) {
  const updates = micro.updates || [];
  if (!updates.length) {
    return null;
  }
  if (micro.live?.status) {
    return row('updates', [{ text: String(updates.length) }]);
  }
  const latest = updates.reduce((a, b) =>
    new Date(b.at) > new Date(a.at) ? b : a,
  );
  const counts = Object.entries(UPDATE_WORDS)
    .map(([kind, word]) => [
      updates.filter((u) => u.kind === kind).length,
      word,
    ])
    .filter(([n]) => n)
    .map(([n, word]) => plural(n, word))
    .join(', ');
  return row('updated', [
    {
      text: shortDate(latest.at, options),
      href: `${href}#update-${latest.id}`,
    },
    ...(counts ? [{ text: counts }] : []),
  ]);
}

// The articles a post quotes from: its linked reading entries, when it has quotes.
function quotingRow(micro) {
  const hasQuote = (micro.post?.blocks || []).some((b) => b.type === 'quote');
  const articles = (micro.relatedPosts || [])
    .filter((related) => related.model === 'ShortformEntry' && related.ref)
    .map((related) => ({
      text: `“${related.ref.title}”`,
      href: related.ref.href,
    }));
  return hasQuote ? row('quoting', articles) : null;
}

function microRows(micro, href, options) {
  return {
    updated: updatesRow(micro, href, options),
    quoting: quotingRow(micro),
    to: micro.inReplyTo?.url
      ? row('to', [
          {
            text: `${micro.inReplyTo.name || 'their'}’s post`,
            href: micro.inReplyTo.url,
          },
        ])
      : null,
    sources: row(
      'sources',
      (micro.sources || [])
        .filter((source) => source.url)
        .map((source) => ({
          text: source.label || source.url,
          href: source.url,
        })),
    ),
    data: micro.data?.url
      ? row('data', [
          { text: micro.data.label || micro.data.url, href: micro.data.url },
        ])
      : null,
    tags: tagsRow(micro.tags, options.tagBase, { counts: options.isPermalink }),
    ...(options.isPermalink ? permalinkRows(micro, href) : {}),
  };
}

// Rows only a post's own page has.
function permalinkRows(micro, href) {
  const fromReading = (micro.relatedPosts || []).some(
    (related) => related.model === 'ShortformEntry' && related.ref,
  );
  const archive = micro.pageMeta?.archive;
  const linkCount = archive?.total
    ? archive.archived < archive.total
      ? `${archive.archived} of ${plural(archive.total, 'link')}`
      : archive.total === 1
        ? '1 link'
        : `all ${plural(archive.total, 'link')}`
    : null;
  return {
    // The post's u-url here, since on its own page the date above isn't a link
    permalink: row('permalink', [{ text: href, href, className: 'u-url' }]),
    from: row(
      'from',
      [
        { text: 'micro posts', href: '/micro' },
        ...(fromReading
          ? [{ text: 'shortform reading', href: '/reading/shortform' }]
          : []),
      ],
      { separator: ' + ' },
    ),
    archived:
      archive && (archive.page || archive.archived)
        ? row('archived', [
            ...(archive.page
              ? [{ text: 'this page', href: archive.page }]
              : []),
            ...(archive.archived ? [{ text: linkCount }] : []),
          ])
        : null,
  };
}

function microMeta(micro, options) {
  const href = `/micro/entry/${micro.slug}`;
  let icon = 'chat';
  let verb = 'Posted';
  if (micro.live?.status) {
    icon = 'live';
    verb = 'Started';
  } else if (micro.inReplyTo?.url) {
    icon = 'reply';
    verb = 'Replied';
  } else if (isQuoteOnly(micro)) {
    icon = 'quote';
    verb = 'Quoted';
  }
  const reply = micro.inReplyTo;
  return {
    icon,
    verb,
    date: { at: micro.createdAt, href, withTime: true },
    // "in reply to [Name] on Bluesky · Oct 29", shown above the post.
    replyTo: reply?.url
      ? {
          name: reply.name || 'a post',
          url: reply.url,
          networkLabel: reply.networkLabel || null,
          date: reply.postedAt ? shortDate(reply.postedAt, options) : null,
        }
      : null,
    rows: microRows(micro, href, options),
    socialLinks: micro.socialLinks,
    links: [{ text: 'permalink', href, url: `${SITE}${href}` }],
    editUrl: `/micro/editor/${micro.slug}`,
  };
}

function citationNeededMeta(entry, { tagBase }) {
  return {
    icon: 'envelope',
    verb: 'Published',
    date: {
      at: entry.createdAt,
      href: `https://www.citationneeded.news/${entry.slug}`,
    },
    rows: {
      in: row('in', [
        {
          text: 'Citation Needed',
          href: 'https://www.citationneeded.news/',
          italic: true,
        },
      ]),
      tags: tagsRow(entry.tags, tagBase),
    },
    socialLinks: entry.socialLinks,
    editUrl: `/feed/tagger/citationNeeded/${entry._id}`,
  };
}

function shortformMeta(entry, { tagBase }) {
  return {
    icon: 'newspaper',
    verb: 'Read',
    date: {
      at: entry.createdAt,
      href: `/reading/shortform?search=${encodeURIComponent(entry.shortform.title)}`,
    },
    rows: { tags: tagsRow(entry.tags, tagBase) },
    editUrl: `/feed/tagger/readingShortform/${entry._id}`,
  };
}

function bookMeta(entry, options) {
  const { book } = entry;
  let started = null;
  if (book.started && book.completed && entry.status === 'read') {
    const days = Math.round(
      DateTime.fromISO(book.completed).diff(
        DateTime.fromISO(book.started),
        'days',
      ).days,
    );
    // A completed date before the started date is a typo in the entry; show no length then.
    if (days >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(book.started)) {
      started = row('started', [
        {
          text: `${shortDate(book.started, options)} · ${plural(days, 'day')}`,
        },
      ]);
    }
  }
  return {
    icon: 'book',
    verb: BOOK_VERBS[entry.status] || 'Read',
    date: {
      at: entry.createdAt,
      href: `/reading/books?search=${encodeURIComponent(book.title)}`,
    },
    rows: {
      started,
      series: book.series
        ? row('series', [
            {
              text: Number.isFinite(book.seriesNumber)
                ? `${book.series} · ${book.seriesLength ? `${book.seriesNumber}/${book.seriesLength}` : `book ${book.seriesNumber}`}`
                : book.series,
            },
          ])
        : null,
    },
    editUrl: null,
  };
}

// The design's icons for each kind of press: a quote mark for being in the press, a pen for your own
// piece, a microphone for audio, a screen for video and talks.
const PRESS_ICONS = {
  article: 'quote',
  freelance: 'pen',
  podcast: 'speaker',
  radio: 'speaker',
  video: 'tv',
  tv: 'tv',
  talk: 'tv',
};

// Where else each kind of press is listed, and what its outlet is called.
const PRESS_LISTS = {
  freelance: { text: 'Freelance writing', href: '/freelance' },
  talk: { text: 'Speaking', href: '/speaking' },
  podcast: { text: 'Press', href: '/press' },
  radio: { text: 'Press', href: '/press' },
  video: { text: 'Press', href: '/press' },
  tv: { text: 'Press', href: '/press' },
};
const PRESS_OUTLET_LABELS = {
  freelance: 'in',
  talk: 'event',
  podcast: 'show',
  radio: 'show',
  video: 'show',
  tv: 'show',
};

/**
 * A length in words: "52 min", or "45 sec" under a minute.
 * @param {number} seconds
 */
export function lengthText(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  return seconds < 60
    ? `${Math.round(seconds)} sec`
    : `${Math.round(seconds / 60)} min`;
}

function pressMeta(entry, { tagBase, now }) {
  const { press } = entry;
  const { verb, rolePhrase } = getPressDetails(press, { now });
  const outletLabel = PRESS_OUTLET_LABELS[press.kind];
  const length = lengthText(press.duration);
  const drewOn = entry.feedMeta?.drewOn;
  return {
    icon: PRESS_ICONS[press.kind] || 'quote',
    verb,
    date: { at: entry.createdAt, href: press.href || '/press' },
    rows: {
      [outletLabel === 'in' ? 'in' : outletLabel]:
        outletLabel && press.work
          ? row(outletLabel, [
              { text: press.work, italic: outletLabel === 'in' },
            ])
          : null,
      length: length ? row('length', [{ text: length }]) : null,
      'drew on': drewOn
        ? row('drew on', [{ text: drewOn.label, href: drewOn.href }])
        : null,
      tags: tagsRow(entry.tags, tagBase),
      'also in': PRESS_LISTS[press.kind]
        ? row('also in', [PRESS_LISTS[press.kind]])
        : null,
    },
    links: press.href
      ? [
          {
            text:
              press.kind === 'article' || press.kind === 'freelance'
                ? 'article'
                : 'link',
            href: press.href,
            url: press.href,
          },
        ]
      : [],
    editUrl: `/feed/tagger/press/${entry._id}`,
    // For the card: "Quoted in", and whether a talk is still to come.
    press: { rolePhrase, upcoming: isUpcoming(press, { now }) },
  };
}

// Rows from attachFeedMeta (backend/helpers/feedMeta.js): threads, neighbours, about, archives.
function feedMetaRows(feedMeta) {
  if (!feedMeta) {
    return {};
  }
  const link = (n) => (n ? [{ text: n.label, href: n.href }] : []);
  const later = feedMeta.laterIssues || [];
  return {
    thread: row(
      'thread',
      (feedMeta.threads || []).map((t) => ({
        text: `${t.title} · ${t.position} of ${t.total}`,
        href: `/feed/thread/${t.slug}`,
      })),
      { separator: '; ' },
    ),
    previously: row('previously', link(feedMeta.previous)),
    next: row('next', link(feedMeta.next)),
    later: later.length
      ? row('later', [
          {
            text: `${plural(later.length, 'newsletter issue')} ↓`,
            href: `#followed-up-${feedMeta.key}`,
          },
        ])
      : null,
    about: row(
      'about',
      (feedMeta.about || []).map((entity) => ({
        text: entity.name,
        html: entity.html,
      })),
    ),
  };
}

// "mastodon · bluesky": where the post was cross-posted. Never "X".
const discussRow = (socialLinks) =>
  row(
    'discuss',
    (socialLinks || [])
      .filter((link) => link.href)
      .map((link) => ({ text: link.type, href: link.href })),
  );

// "permalink · archived": an archived link appears only once the Wayback copy exists.
function linksRow(links, archived = {}) {
  const items = (links || []).flatMap((link) =>
    archived[link.url]
      ? [link, { text: 'archived', href: archived[link.url] }]
      : [link],
  );
  return items.some((item) => item.text === 'archived')
    ? row('links', items)
    : null;
}

/**
 * The metadata column for a hydrated feed entry, or a micro entry on its own (micro pages). With
 * attachFeedMeta run first, it also has threads, about and archived links.
 * @param {Object} entry
 * @param {{tagBase?: string, now?: DateTime}} [options] tagBase: where tag links go
 * @returns {{icon: string, verb: string, date: {text: string, iso: string, title: string, href: string}, rows: Object[], editUrl: ?string}}
 */
export function entryMeta(
  entry,
  { tagBase = '/feed/tag', now, isPermalink = false } = {},
) {
  const options = { tagBase, now, isPermalink };
  let meta;
  if (entry.entryType === 'micro') {
    meta = microMeta(entry.micro, options);
  } else if (entry.entryType === 'citationNeeded') {
    meta = citationNeededMeta(entry, options);
  } else if (entry.entryType === 'readingShortform') {
    meta = shortformMeta(entry, options);
  } else if (entry.entryType === 'readingBook') {
    meta = bookMeta(entry, options);
  } else if (entry.entryType === 'press') {
    meta = pressMeta(entry, options);
  } else if (entry.slug && entry.post) {
    meta = microMeta(entry, options);
  } else {
    return null;
  }
  const fromFeedMeta = feedMetaRows(entry.feedMeta);
  // A book's "previously" is the one before it in its series, when it isn't in a thread.
  const seriesPrevious = entry.feedMeta?.previousInSeries;
  if (!fromFeedMeta.previously && seriesPrevious) {
    fromFeedMeta.previously = row('previously', [
      { text: seriesPrevious.label, href: seriesPrevious.href, italic: true },
    ]);
  }
  const rows = {
    ...meta.rows,
    ...fromFeedMeta,
    discuss: discussRow(meta.socialLinks),
    links: linksRow(meta.links, entry.feedMeta?.archived),
  };
  if (isPermalink) {
    // The thread box below the post lists the thread; "archived" covers the page and its links.
    delete rows.thread;
    delete rows.links;
  }
  const { at, href, withTime } = meta.date;
  return {
    icon: meta.icon,
    verb: meta.verb,
    replyTo: meta.replyTo || null,
    press: meta.press || null,
    editUrl: meta.editUrl,
    date: {
      text: isPermalink
        ? fullDateTime(at)
        : withTime
          ? shortDateTime(at, { now })
          : shortDate(at, { now }),
      iso: toDateTime(at).toUTC().toISO({ suppressMilliseconds: true }),
      title: fullTime(at),
      href,
      // How the reader's browser rewrites it in their zone (api/helpers/localTimes.js).
      format: isPermalink ? 'full' : withTime ? 'short' : 'day',
    },
    rows: ROW_ORDER.map((key) => rows[key]).filter(Boolean),
  };
}

/**
 * When an update was posted, as it's labelled under its post: just the time on the post's own
 * day ("4:52 pm"), otherwise the date too ("Oct 31, 9:40 am").
 * @param {Date|string} at
 * @param {Date|string} day The post's createdAt, or now for "last updated"
 */
export function updateTime(at, day, { now } = {}) {
  const dt = toDateTime(at);
  if (dt.hasSame(toDateTime(day), 'day')) {
    return dt.toFormat('h:mm a').toLowerCase();
  }
  return shortDateTime(at, { now });
}
