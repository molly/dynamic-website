import axios from 'axios';
import * as cheerio from 'cheerio';
import { cleanHtml, escapeHtml } from '../../api/helpers/html.js';
import { parsePostUrl } from '../../api/helpers/postUrl.js';
import { copyUrlToBucket } from './bucket.js';

// Public posts on Bluesky and Mastodon, from their public APIs: who wrote a post and when (for
// "in reply to"), or the whole post as a social post card. Twitter has no public API, so only what
// its URLs say is returned and its cards are filled in by hand.

const config = {
  timeout: 10000,
  headers: {
    'User-Agent':
      'mollywhite.net editor (https://github.com/molly/dynamic-website)',
  },
};
const BSKY_API = 'https://public.api.bsky.app/xrpc';

// Raw API responses ------------------------------------------------------------------------------

async function resolveDid(handle) {
  if (handle.startsWith('did:')) {
    return handle;
  }
  const { data } = await axios.get(
    `${BSKY_API}/com.atproto.identity.resolveHandle`,
    { ...config, params: { handle } },
  );
  return data.did;
}

async function getBlueskyPost({ handle, rkey }) {
  const did = await resolveDid(handle);
  const { data } = await axios.get(`${BSKY_API}/app.bsky.feed.getPosts`, {
    ...config,
    params: { uris: `at://${did}/app.bsky.feed.post/${rkey}` },
  });
  const post = data.posts?.[0];
  if (!post) {
    throw new Error(
      'That Bluesky post was not found; it may have been deleted.',
    );
  }
  return post;
}

async function getMastodonStatus({ host, id }) {
  const { data } = await axios.get(
    `https://${host}/api/v1/statuses/${id}`,
    config,
  );
  return data.reblog || data; // A boost's URL means the boosted post
}

const mastodonHandle = (account, host) =>
  account.acct.includes('@') ? account.acct : `${account.acct}@${host}`;

// "In reply to" ----------------------------------------------------------------------------------

/**
 * @param {string} url A link to a single post
 * @returns {Promise<{network: string, url: string, name?: string, handle?: string, postedAt?: string}>}
 * @throws When the URL isn't a post link, or the post can't be fetched
 */
export async function fetchPostInfo(url) {
  const parsed = parsePostUrl(url);
  if (!parsed) {
    throw new Error('Not a link to a Bluesky, Mastodon or Twitter post.');
  }
  const base = { network: parsed.network, url: url.trim() };
  if (parsed.network === 'bluesky') {
    const post = await getBlueskyPost(parsed);
    return {
      ...base,
      name: post.author.displayName || post.author.handle,
      handle: post.author.handle,
      postedAt: post.record?.createdAt || post.indexedAt,
    };
  }
  if (parsed.network === 'mastodon') {
    const status = await getMastodonStatus(parsed);
    return {
      ...base,
      name: status.account.display_name || status.account.username,
      handle: mastodonHandle(status.account, parsed.host),
      postedAt: status.created_at,
    };
  }
  return { ...base, handle: parsed.handle };
}

// Social post cards ------------------------------------------------------------------------------
// A card's post: { network, authorName, handle, profileUrl, originalUrl, postedAt, textHtml (links
// and line breaks only), media: [{ type: 'image' |
// 'video', src, remoteUrl, alt, poster, duration, saved }], linkCard: { url, domain, title },
// quoted: another post }. `saved` media were copied to the bucket; `src` is the copy.

const domainOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/**
 * A Bluesky post's text as HTML, with its links, mentions and hashtags (facets) as links. Facet
 * positions count UTF-8 bytes, not characters.
 * @param {string} text
 * @param {Object[]} [facets]
 */
export function blueskyTextToHtml(text, facets = []) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const bytes = encoder.encode(text || '');
  const sorted = [...facets].sort(
    (a, b) => a.index.byteStart - b.index.byteStart,
  );
  let html = '';
  let position = 0;
  for (const facet of sorted) {
    const { byteStart, byteEnd } = facet.index;
    if (byteStart < position || byteEnd > bytes.length) {
      continue; // Overlapping or out of range
    }
    html += escapeHtml(decoder.decode(bytes.slice(position, byteStart)));
    const inner = escapeHtml(decoder.decode(bytes.slice(byteStart, byteEnd)));
    const feature = facet.features?.[0] || {};
    let href = null;
    if (feature.$type === 'app.bsky.richtext.facet#link') {
      href = feature.uri;
    } else if (feature.$type === 'app.bsky.richtext.facet#mention') {
      href = `https://bsky.app/profile/${feature.did}`;
    } else if (feature.$type === 'app.bsky.richtext.facet#tag') {
      href = `https://bsky.app/hashtag/${encodeURIComponent(feature.tag)}`;
    }
    html += href ? `<a href="${escapeHtml(href)}">${inner}</a>` : inner;
    position = byteEnd;
  }
  html += escapeHtml(decoder.decode(bytes.slice(position)));
  return cleanHtml(html.replace(/\n/g, '<br>'));
}

/**
 * A Mastodon post's HTML as card text: paragraphs become blank lines, and links show the text
 * Mastodon shows (it hides parts of long URLs in spans).
 * @param {string} content
 */
export function mastodonContentToHtml(content) {
  const $ = cheerio.load(content || '', null, false);
  $('.invisible').remove();
  $('.ellipsis').each((_, el) => {
    $(el).replaceWith(`${$(el).text()}…`);
  });
  const paragraphs = $('p').length
    ? $('p')
        .toArray()
        .map((p) => $(p).html())
    : [$.html()];
  return cleanHtml(paragraphs.join('<br><br>'));
}

const bskyPostUrl = (author, uri) =>
  `https://bsky.app/profile/${author.handle}/post/${uri.split('/').pop()}`;

// The CID in a Bluesky CDN image URL (…/plain/<did>/<cid>@jpeg), for naming the copy.
const cdnCid = (url) => url.split('/').pop().split('@')[0];

function blueskyMedia(embed, did) {
  if (!embed) {
    return { media: [], linkCard: null, quotedView: null };
  }
  switch (embed.$type) {
    case 'app.bsky.embed.images#view':
      return {
        media: embed.images.map((image) => ({
          type: 'image',
          remoteUrl: image.fullsize,
          filename: `${cdnCid(image.fullsize)}.jpg`,
          alt: image.alt || '',
        })),
        linkCard: null,
        quotedView: null,
      };
    case 'app.bsky.embed.video#view':
      return {
        media: [
          {
            type: 'video',
            // The original upload, from the author's server (the CDN only serves HLS)
            blob: { did, cid: embed.cid },
            filename: `${embed.cid}.mp4`,
            remotePoster: embed.thumbnail,
            alt: embed.alt || '',
          },
        ],
        linkCard: null,
        quotedView: null,
      };
    case 'app.bsky.embed.external#view':
      return {
        media: [],
        linkCard: {
          url: embed.external.uri,
          domain: domainOf(embed.external.uri),
          title: embed.external.title || '',
        },
        quotedView: null,
      };
    case 'app.bsky.embed.record#view':
      return {
        media: [],
        linkCard: null,
        quotedView:
          embed.record?.$type === 'app.bsky.embed.record#viewRecord'
            ? embed.record
            : null,
      };
    case 'app.bsky.embed.recordWithMedia#view': {
      const withMedia = blueskyMedia(embed.media, did);
      return {
        ...withMedia,
        quotedView:
          embed.record?.record?.$type === 'app.bsky.embed.record#viewRecord'
            ? embed.record.record
            : null,
      };
    }
    default:
      return { media: [], linkCard: null, quotedView: null };
  }
}

/**
 * A Bluesky post (a feed PostView, or the ViewRecord of a quoted post) as a card's post, before
 * its media are copied.
 * @param {Object} view
 * @param {{quoted?: boolean}} [options] quoted: don't go deeper than one quoted post
 */
export function blueskyToPost(view, { quoted = false } = {}) {
  const record = view.record?.text !== undefined ? view.record : view.value;
  const embed = view.embed || view.embeds?.[0];
  const { media, linkCard, quotedView } = blueskyMedia(embed, view.author.did);
  return {
    network: 'bluesky',
    authorName: view.author.displayName || view.author.handle,
    handle: view.author.handle,
    profileUrl: `https://bsky.app/profile/${view.author.handle}`,
    originalUrl: bskyPostUrl(view.author, view.uri),
    postedAt: record.createdAt || view.indexedAt,
    textHtml: blueskyTextToHtml(record.text, record.facets),
    media,
    linkCard,
    quoted:
      quotedView && !quoted
        ? blueskyToPost(quotedView, { quoted: true })
        : null,
  };
}

/**
 * A Mastodon status as a card's post, before its media are copied.
 * @param {Object} status
 * @param {string} host The server the status was fetched from
 * @param {{quoted?: boolean}} [options]
 */
export function mastodonToPost(status, host, { quoted = false } = {}) {
  const quotedStatus = status.quote?.quoted_status || null; // Mastodon 4.4+
  return {
    network: 'mastodon',
    authorName: status.account.display_name || status.account.username,
    handle: mastodonHandle(status.account, host),
    profileUrl: status.account.url,
    originalUrl: status.url || status.uri,
    postedAt: status.created_at,
    textHtml: mastodonContentToHtml(status.content),
    media: (status.media_attachments || [])
      .filter((m) => ['image', 'video', 'gifv'].includes(m.type))
      .map((m) => ({
        type: m.type === 'image' ? 'image' : 'video',
        remoteUrl: m.url,
        remotePoster: m.type === 'image' ? null : m.preview_url,
        duration: m.meta?.original?.duration ?? null,
        alt: m.description || '',
      })),
    linkCard: status.card?.url
      ? {
          url: status.card.url,
          domain: domainOf(status.card.url),
          title: status.card.title || '',
        }
      : null,
    quoted:
      quotedStatus && !quoted
        ? mastodonToPost(quotedStatus, host, { quoted: true })
        : null,
  };
}

async function blueskyBlobUrl({ did, cid }) {
  const { data } = await axios.get(
    did.startsWith('did:web:')
      ? `https://${did.slice('did:web:'.length)}/.well-known/did.json`
      : `https://plc.directory/${did}`,
    config,
  );
  const pds = data.service?.find(
    (s) => s.id === '#atproto_pds',
  )?.serviceEndpoint;
  if (!pds) {
    throw new Error(`No server found for ${did}`);
  }
  return `${pds}/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(cid)}`;
}

/**
 * Copy a post's media (and its quoted post's) to the bucket. A file that can't be copied is kept
 * as unsaved, with its alt text, so the card says it wasn't archived.
 * @param {Object} post
 * @param {boolean} copy False: mark everything unsaved without copying (for tests)
 */
async function saveMedia(post, copy) {
  const media = await Promise.all(
    post.media.map(async ({ blob, filename, remotePoster, ...item }) => {
      const remoteUrl =
        item.remoteUrl || (blob ? await blueskyBlobUrl(blob) : null);
      const base = {
        ...item,
        remoteUrl,
        poster: null,
        src: null,
        saved: false,
      };
      if (!copy || !remoteUrl) {
        return base;
      }
      try {
        const [file, poster] = await Promise.all([
          copyUrlToBucket(remoteUrl, { filename }),
          remotePoster ? copyUrlToBucket(remotePoster).catch(() => null) : null,
        ]);
        return {
          ...base,
          src: file.url,
          poster: poster?.url || null,
          saved: true,
        };
      } catch (err) {
        console.error(`Couldn't copy ${remoteUrl}:`, err.message);
        return base;
      }
    }),
  );
  return {
    ...post,
    media,
    quoted: post.quoted ? await saveMedia(post.quoted, copy) : null,
  };
}

/**
 * Fetch a Bluesky or Mastodon post as a social post card's post, with its media copied to the
 * bucket.
 * @param {string} url
 * @param {{copyMedia?: boolean}} [options]
 * @throws When the URL isn't a Bluesky or Mastodon post, or it can't be fetched
 */
export async function fetchSocialPost(url, { copyMedia = true } = {}) {
  const parsed = parsePostUrl(url);
  if (!parsed || parsed.network === 'twitter') {
    throw new Error(
      parsed
        ? 'Twitter posts can’t be fetched; fill in the card by hand.'
        : 'Not a link to a Bluesky or Mastodon post.',
    );
  }
  const post =
    parsed.network === 'bluesky'
      ? blueskyToPost(await getBlueskyPost(parsed))
      : mastodonToPost(await getMastodonStatus(parsed), parsed.host);
  return saveMedia(post, copyMedia);
}
