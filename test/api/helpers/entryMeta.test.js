import { DateTime } from 'luxon';
import { parseDuration } from '../../../api/helpers/duration';
import {
  entryMeta,
  lengthText,
  shortDate,
  shortDateTime,
} from '../../../api/helpers/entryMeta';
import { feedExcerpt } from '../../../api/helpers/feedExcerpt';
import { feedFilter } from '../../../api/helpers/feedFilters';
import { groupReading } from '../../../api/helpers/readingGroups';

const now = DateTime.fromISO('2026-11-07T12:00:00', {
  zone: 'America/New_York',
});
const at = new Date('2026-11-05T19:53:00Z'); // 2:53 pm Eastern
const tags = [
  { value: 'crypto_lobby', text: 'crypto lobby' },
  { value: 'elections', text: 'elections' },
];

describe('dates', () => {
  it('drops the year this year and keeps it otherwise', () => {
    expect(shortDateTime(at, { now })).toEqual('Nov 5, 2:53 pm');
    expect(shortDateTime(new Date('2024-10-01T18:38:00Z'), { now })).toEqual(
      'Oct 1, 2024, 2:38 pm',
    );
    expect(shortDate('2026-10-16', { now })).toEqual('Oct 16');
    expect(shortDate('2025-01-02', { now })).toEqual('Jan 2, 2025');
  });
});

describe('entryMeta', () => {
  const micro = (fields = {}) => ({
    entryType: 'micro',
    micro: {
      slug: '202611051453',
      createdAt: at,
      post: { blocks: [{ type: 'paragraph', data: { text: 'Hi' } }] },
      tags,
      ...fields,
    },
  });

  it('describes a post: verb, linked date and tags', () => {
    const meta = entryMeta(micro(), { now });
    expect(meta).toMatchObject({
      icon: 'chat',
      verb: 'Posted',
      date: {
        text: 'Nov 5, 2:53 pm',
        href: '/micro/entry/202611051453',
        iso: '2026-11-05T19:53:00Z',
      },
      rows: [
        {
          label: 'tags',
          items: [
            { text: '#crypto-lobby', href: '/feed/tag/crypto_lobby' },
            { text: '#elections', href: '/feed/tag/elections' },
          ],
        },
      ],
      editUrl: '/micro/editor/202611051453',
    });
  });

  it('calls a post of only quotes "Quoted", a reply "Replied" and a live post "Started"', () => {
    expect(
      entryMeta(micro({ post: { blocks: [{ type: 'quote', data: {} }] } }), {
        now,
      }).verb,
    ).toEqual('Quoted');
    const reply = entryMeta(
      micro({
        inReplyTo: {
          name: 'Jane',
          url: 'https://bsky.app/x',
          networkLabel: 'Bluesky',
          postedAt: new Date('2026-10-29T12:00:00Z'),
        },
      }),
      { now },
    );
    expect(reply.verb).toEqual('Replied');
    expect(reply.replyTo).toEqual({
      name: 'Jane',
      url: 'https://bsky.app/x',
      networkLabel: 'Bluesky',
      date: 'Oct 29',
    });
    expect(
      entryMeta(micro({ live: { status: 'updating' } }), { now }).verb,
    ).toEqual('Started');
  });

  it('links tags to the micro feed on micro pages, and skips empty rows', () => {
    const meta = entryMeta(micro({ tags: [] }), { now, tagBase: '/micro/tag' });
    expect(meta.rows).toEqual([]);
    expect(
      entryMeta(micro(), { now, tagBase: '/micro/tag' }).rows[0].items[0].href,
    ).toEqual('/micro/tag/crypto_lobby');
  });

  it('describes a newsletter issue, a finished book and press', () => {
    const issue = entryMeta(
      {
        entryType: 'citationNeeded',
        _id: 'c1',
        slug: 'x',
        createdAt: at,
        tags: [],
      },
      { now },
    );
    expect(issue).toMatchObject({
      icon: 'envelope',
      verb: 'Published',
      date: { text: 'Nov 5', href: 'https://www.citationneeded.news/x' },
      rows: [
        { label: 'in', items: [{ text: 'Citation Needed', italic: true }] },
      ],
    });

    const book = entryMeta(
      {
        entryType: 'readingBook',
        status: 'read',
        createdAt: at,
        book: {
          title: 'A Darkness More Than Night',
          started: '2026-10-16',
          completed: '2026-10-24',
        },
      },
      { now },
    );
    expect(book.verb).toEqual('Finished');
    expect(book.rows).toEqual([
      { label: 'started', items: [{ text: 'Oct 16 · 8 days' }] },
    ]);
    // Completed before started is a typo in the entry: no length rather than a negative one.
    const typo = entryMeta(
      {
        entryType: 'readingBook',
        status: 'read',
        createdAt: at,
        book: { title: 'Typo', started: '2026-09-30', completed: '2026-09-01' },
      },
      { now },
    );
    expect(typo.rows).toEqual([]);

    const pressEntry = {
      entryType: 'press',
      _id: 'p1',
      createdAt: at,
      tags: [],
      press: { kind: 'podcast', href: 'https://example.com/ep' },
    };
    const press = entryMeta(pressEntry, { now });
    expect(press).toMatchObject({
      icon: 'speaker',
      verb: 'Appeared on',
      date: { href: 'https://example.com/ep' },
    });
    // The date links to the piece; "links" waits for an archived copy.
    const ALSO_IN_PRESS = {
      label: 'also in',
      items: [{ text: 'Press', href: '/press' }],
    };
    expect(press.rows).toEqual([ALSO_IN_PRESS]);
    expect(
      entryMeta(
        {
          ...pressEntry,
          feedMeta: {
            archived: {
              'https://example.com/ep': 'https://web.archive.org/ep',
            },
          },
        },
        { now },
      ).rows,
    ).toEqual([
      ALSO_IN_PRESS,
      {
        label: 'links',
        items: [
          {
            text: 'link',
            href: 'https://example.com/ep',
            url: 'https://example.com/ep',
          },
          { text: 'archived', href: 'https://web.archive.org/ep' },
        ],
      },
    ]);
  });
});

describe('feed filters', () => {
  it('narrows the feed to one kind of entry, or shows everything', () => {
    expect(feedFilter('books').query).toEqual({
      __t: 'FeedEntryReading',
      book: { $exists: true },
    });
    expect(feedFilter('nonsense')).toEqual({ filter: null, query: {} });
  });
});

describe('feedExcerpt', () => {
  const post = (types) => ({
    post: { blocks: types.map((type) => ({ type })) },
    html: types.map((type, i) =>
      type === 'socialPostDelimiter' ? '' : `<${type}${i}>`,
    ),
  });

  it('shows two paragraphs and one image or card, then says it continues', () => {
    expect(
      feedExcerpt(
        post(['paragraph', 'image', 'paragraph', 'paragraph', 'image']),
      ),
    ).toEqual({
      html: ['<paragraph0>', '<image1>', '<paragraph2>'],
      truncated: true,
      next: '<paragraph3>', // The teaser
    });
    expect(
      feedExcerpt(post(['paragraph', 'socialPostDelimiter', 'image'])),
    ).toEqual({
      html: ['<paragraph0>', '<image2>'],
      truncated: false,
    });
  });
});

describe('metadata rows from threads, about and archives', () => {
  const entry = {
    entryType: 'micro',
    micro: {
      slug: 'p1',
      createdAt: at,
      post: { blocks: [{ type: 'paragraph' }] },
      tags: [],
      sources: [{ label: 'complaint (PDF)', url: 'https://x/c.pdf' }],
      updates: [
        { id: 'u1', kind: 'update', at: '2026-10-31T13:40:00Z' },
        { id: 'u2', kind: 'correction', at: '2026-10-31T18:15:00Z' },
      ],
      socialLinks: [
        { type: 'mastodon', href: 'https://m/1' },
        { type: 'bluesky', href: 'https://b/1' },
      ],
    },
    feedMeta: {
      threads: [
        { title: 'Binance hack', slug: 'binance-hack', position: 1, total: 3 },
      ],
      previous: null,
      next: { label: 'North Korea gets away', href: 'https://cn/nk' },
      laterIssues: [
        { label: 'North Korea gets away', href: 'https://cn/nk' },
        { label: 'It’s always North Korea', href: 'https://cn/ak' },
      ],
      about: [
        { name: 'Binance', html: '<span class="cdx-mention">Binance</span>' },
      ],
      archived: {
        'https://www.mollywhite.net/micro/entry/p1':
          'https://web.archive.org/x',
      },
    },
  };

  it('puts every row in the design’s order', () => {
    const rows = entryMeta(entry, { now }).rows;
    expect(rows.map((r) => r.label)).toEqual([
      'updated',
      'sources',
      'thread',
      'next',
      'later',
      'about',
      'discuss',
      'links',
    ]);
    const byLabel = Object.fromEntries(rows.map((r) => [r.label, r.items]));
    expect(byLabel.updated).toEqual([
      { text: 'Oct 31', href: '/micro/entry/p1#update-u2' },
      { text: '1 update, 1 correction' },
    ]);
    expect(byLabel.thread).toEqual([
      { text: 'Binance hack · 1 of 3', href: '/feed/thread/binance-hack' },
    ]);
    expect(byLabel.later[0].text).toEqual('2 newsletter issues ↓');
    expect(byLabel.discuss.map((i) => i.text)).toEqual(['mastodon', 'bluesky']);
    expect(byLabel.links.map((i) => i.text)).toEqual(['permalink', 'archived']);
  });

  it('leaves out "links" until there’s an archived copy', () => {
    const rows = entryMeta(
      { ...entry, feedMeta: { ...entry.feedMeta, archived: {} } },
      { now },
    ).rows;
    expect(rows.map((r) => r.label)).not.toContain('links');
  });
});

describe('reading in the feed', () => {
  const read = (id, iso) => ({
    entryType: 'readingShortform',
    _id: id,
    createdAt: new Date(iso),
  });
  const post = (id, iso) => ({
    entryType: 'micro',
    _id: id,
    createdAt: new Date(iso),
  });

  it('groups neighbouring reading from the same day, keeping the feed in order', () => {
    const items = groupReading(
      [
        read('a', '2026-10-28T20:00:00Z'),
        read('b', '2026-10-28T15:00:00Z'),
        post('p', '2026-10-28T14:00:00Z'),
        read('c', '2026-10-28T13:00:00Z'),
        read('d', '2026-10-28T03:00:00Z'), // Oct 27, 11 pm Eastern
      ],
      { now },
    );
    expect(
      items.map((item) =>
        item.entryType === 'readingGroup'
          ? `${item.dateText}:${item.entries.map((e) => e._id).join('')}`
          : item._id,
      ),
    ).toEqual(['Oct 28:ab', 'p', 'Oct 28:c', 'Oct 27:d']);
  });

  it('shows a book’s series and the one before it', () => {
    const meta = entryMeta(
      {
        entryType: 'readingBook',
        status: 'read',
        createdAt: at,
        book: {
          title: 'A Darkness More Than Night',
          series: 'Harry Bosch',
          seriesNumber: 7,
          seriesLength: 24,
          started: '2026-10-16',
          completed: '2026-10-24',
        },
        feedMeta: {
          previousInSeries: {
            label: 'Angels Flight',
            href: '/reading/books?search=Angels%20Flight',
          },
        },
      },
      { now },
    );
    expect(meta.rows).toEqual([
      { label: 'started', items: [{ text: 'Oct 16 · 8 days' }] },
      { label: 'series', items: [{ text: 'Harry Bosch · 7/24' }] },
      {
        label: 'previously',
        items: [
          {
            text: 'Angels Flight',
            href: '/reading/books?search=Angels%20Flight',
            italic: true,
          },
        ],
      },
    ]);
  });
});

describe('press cards', () => {
  const pressEntry = (press, feedMeta) => ({
    entryType: 'press',
    _id: 'p',
    createdAt: at,
    tags: [],
    press,
    feedMeta,
  });

  it('names the show, its length and where else it’s listed', () => {
    const meta = entryMeta(
      pressEntry({
        kind: 'podcast',
        work: 'The Bunker',
        duration: 3150,
        href: 'https://x',
      }),
      { now },
    );
    expect(
      meta.rows.map((r) => [r.label, r.items.map((i) => i.text).join()]),
    ).toEqual([
      ['show', 'The Bunker'],
      ['length', '53 min'],
      ['also in', 'Press'],
    ]);
  });

  it('says what an article drew on, and keeps the role for the sentence', () => {
    const meta = entryMeta(
      pressEntry(
        {
          kind: 'article',
          role: 'quoted',
          work: 'The Atlantic',
          href: 'https://x',
        },
        { drewOn: { label: 'Coinbase FEC complaint', href: '/micro/entry/c' } },
      ),
      { now },
    );
    expect(meta.verb).toEqual('In the press');
    expect(meta.press).toEqual({ rolePhrase: 'Quoted in', upcoming: false });
    expect(meta.rows).toEqual([
      {
        label: 'drew on',
        items: [{ text: 'Coinbase FEC complaint', href: '/micro/entry/c' }],
      },
    ]);
  });

  it('lists your own pieces and talks with their pages', () => {
    const freelance = entryMeta(
      pressEntry({ kind: 'freelance', work: 'Bloomberg' }),
      { now },
    );
    expect(freelance.verb).toEqual('Published');
    expect(freelance.rows.map((r) => r.label)).toEqual(['in', 'also in']);
    const talk = entryMeta(
      pressEntry({
        kind: 'talk',
        work: 'Web Summit',
        date: '2026-11-20',
        duration: 2292,
      }),
      { now },
    );
    expect(talk).toMatchObject({ verb: 'Speaking', press: { upcoming: true } });
    expect(talk.rows.map((r) => [r.label, r.items[0].text])).toEqual([
      ['event', 'Web Summit'],
      ['length', '38 min'],
      ['also in', 'Speaking'],
    ]);
  });
});

describe('typed lengths', () => {
  it('reads minutes:seconds, hours:minutes:seconds, or a number of minutes', () => {
    expect(parseDuration('52:30')).toEqual(3150);
    expect(parseDuration('1:02:30')).toEqual(3750);
    expect(parseDuration('38')).toEqual(2280);
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('52:75')).toBeNaN();
    expect(lengthText(45)).toEqual('45 sec');
  });
});
