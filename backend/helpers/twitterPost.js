import { cleanHtml, escapeHtml } from '../../api/helpers/html.js';
import {
  domainOf,
  parsePostUrl,
  twitterProfileUrl,
} from '../../api/helpers/postUrl.js';
import { decodeEntities } from '../../api/helpers/socialThreads.js';

// Twitter posts as social post cards, from the data x.com's own web app loads (its GraphQL
// responses, e.g. TweetDetail). Twitter has no free API, so the local X helper
// (backend/scripts/xComposeHelper.js) opens the post in a logged-in browser and passes what x.com
// loaded to tweetThread. The result is a list of posts as backend/helpers/socialFetch.js describes,
// with media not yet copied; the server copies them (saveTwitterPosts).
//
// These responses are undocumented and change from time to time. Tweets are found by their shape
// wherever they appear in the response rather than by a fixed path, and every field is optional.

// The most posts above the pasted one to follow up a reply chain
const MAX_CHAIN = 25;

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// A tweet result, unwrapped from the wrapper x.com uses for posts with limited visibility. Null for
// deleted, withheld or otherwise unavailable posts (tombstones).
function unwrap(result) {
  const tweet = result?.tweet || result;
  return tweet?.rest_id && tweet.legacy ? tweet : null;
}

/**
 * Every tweet in a response, by ID.
 * @param {*} node
 * @param {Map<string, Object>} [found]
 * @returns {Map<string, Object>}
 */
export function collectTweets(node, found = new Map()) {
  if (Array.isArray(node)) {
    node.forEach((child) => collectTweets(child, found));
  } else if (node && typeof node === 'object') {
    // Users have rest_id and legacy too, but no text
    if (
      node.rest_id &&
      typeof node.legacy?.full_text === 'string' &&
      !found.has(node.rest_id)
    ) {
      found.set(node.rest_id, node);
    }
    Object.values(node).forEach((child) => collectTweets(child, found));
  }
  return found;
}

function author(tweet) {
  const user = tweet.core?.user_results?.result || {};
  // Name and handle moved from user.legacy to user.core in 2025; accept either
  const handle = user.core?.screen_name || user.legacy?.screen_name || '';
  return {
    accountId: user.rest_id || '',
    handle,
    authorName: user.core?.name || user.legacy?.name || handle,
  };
}

/**
 * A tweet's text as card HTML. Mentions link to the account by its permanent user ID, links show
 * what x.com shows (display_url) and go to the real URL rather than t.co, and the t.co links that
 * x.com hides (attached media, the quoted post) are dropped.
 * @param {Object} tweet
 * @param {string} [quotedId] The quoted post's ID, whose link is dropped
 */
export function tweetTextToHtml(tweet, quotedId) {
  const legacy = tweet.legacy || {};
  // Posts over 280 characters keep their full text separately; legacy.full_text is cut short
  const note = tweet.note_tweet?.note_tweet_results?.result;
  const raw = decodeEntities(note?.text ?? legacy.full_text ?? '');
  const chars = [...raw];
  // Leading @handles that only say who a reply is to fall outside the displayed range, as on x.com
  const [start, end] =
    !note && legacy.display_text_range
      ? legacy.display_text_range
      : [0, chars.length];
  const text = chars.slice(start, end).join('');

  const entities = note?.entity_set || legacy.entities || {};
  const replacements = new Map();
  for (const mention of entities.user_mentions || []) {
    if (mention.screen_name && mention.id_str) {
      const href = twitterProfileUrl({ accountId: mention.id_str });
      replacements.set(
        `@${mention.screen_name}`.toLowerCase(),
        (written) => `<a href="${escapeHtml(href)}">${escapeHtml(written)}</a>`,
      );
    }
  }
  for (const url of entities.urls || []) {
    if (!url.url) {
      continue;
    }
    const target = url.expanded_url || url.url;
    const hidden = quotedId && parsePostUrl(target)?.id === quotedId;
    replacements.set(url.url.toLowerCase(), () =>
      hidden
        ? ''
        : `<a href="${escapeHtml(target)}">${escapeHtml(url.display_url || target)}</a>`,
    );
  }
  for (const media of legacy.entities?.media || []) {
    if (media.url) {
      replacements.set(media.url.toLowerCase(), () => '');
    }
  }

  let html = '';
  if (replacements.size) {
    // Longest first, so @ab isn't matched as @a; a handle must end where the name does
    const pattern = new RegExp(
      [...replacements.keys()]
        .sort((a, b) => b.length - a.length)
        .map(
          (token) =>
            escapeRegExp(token) +
            (token.startsWith('@') ? '(?![A-Za-z0-9_])' : ''),
        )
        .join('|'),
      'gi',
    );
    let last = 0;
    for (const match of text.matchAll(pattern)) {
      html +=
        escapeHtml(text.slice(last, match.index)) +
        replacements.get(match[0].toLowerCase())(match[0]);
      last = match.index + match[0].length;
    }
    html += escapeHtml(text.slice(last));
  } else {
    html = escapeHtml(text);
  }
  return cleanHtml(html.trim().replace(/\n/g, '<br>'));
}

const fileName = (url) => {
  try {
    return new URL(url).pathname.split('/').pop();
  } catch {
    return undefined;
  }
};

function tweetMedia(tweet) {
  const media =
    tweet.legacy?.extended_entities?.media ||
    tweet.legacy?.entities?.media ||
    [];
  return media.map((item) => {
    const alt = item.ext_alt_text || '';
    if (item.type === 'photo') {
      return {
        type: 'image',
        remoteUrl: `${item.media_url_https}?name=orig`,
        filename: fileName(item.media_url_https),
        alt,
      };
    }
    // Videos and GIFs: the best MP4 (x.com also offers HLS streams, which can't be saved as one file)
    const best = (item.video_info?.variants || [])
      .filter((v) => v.content_type === 'video/mp4' && v.url)
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
    return {
      type: 'video',
      remoteUrl: best?.url || null,
      filename: best ? fileName(best.url) : undefined,
      remotePoster: item.media_url_https || null,
      duration: item.video_info?.duration_millis
        ? item.video_info.duration_millis / 1000
        : null,
      alt,
    };
  });
}

function linkCard(tweet) {
  const values = Object.fromEntries(
    (tweet.card?.legacy?.binding_values || []).map(({ key, value }) => [
      key,
      value?.string_value,
    ]),
  );
  if (!values.card_url || !values.title) {
    return null;
  }
  // The card's URL is a t.co link; the text's link entities say where it goes
  const urls = tweet.legacy?.entities?.urls || [];
  const url =
    urls.find((u) => u.url === values.card_url)?.expanded_url ||
    values.card_url;
  return { url, domain: domainOf(url), title: values.title };
}

/**
 * A tweet as a card's post, before its media are copied.
 * @param {Object} tweet
 * @param {{quoted?: boolean}} [options] quoted: don't go deeper than one quoted post
 */
export function twitterToPost(tweet, { quoted = false } = {}) {
  const { accountId, handle, authorName } = author(tweet);
  const quotedTweet = quoted
    ? null
    : unwrap(tweet.quoted_status_result?.result);
  const createdAt = new Date(tweet.legacy?.created_at);
  return {
    network: 'twitter',
    authorName,
    handle,
    accountId,
    profileUrl: twitterProfileUrl({ accountId, handle }),
    // x.com finds a post by its ID whatever name is in the link, so this survives renames
    originalUrl: `https://twitter.com/${handle || 'i'}/status/${tweet.rest_id}`,
    postedAt: Number.isNaN(createdAt.getTime())
      ? null
      : createdAt.toISOString(),
    textHtml: tweetTextToHtml(
      tweet,
      quotedTweet?.rest_id || tweet.legacy?.quoted_status_id_str,
    ),
    media: tweetMedia(tweet),
    linkCard: linkCard(tweet),
    quoted: quotedTweet ? twitterToPost(quotedTweet, { quoted: true }) : null,
  };
}

/**
 * The pasted post, preceded by the posts it replies to (as far as x.com loaded them), oldest first.
 * @param {Object} response What x.com loaded for the post's page
 * @param {string} id The pasted post's ID
 * @throws When the post isn't in the response
 */
export function tweetThread(response, id) {
  const tweets = collectTweets(response);
  const focal = tweets.get(id);
  if (!focal) {
    throw new Error(
      'x.com didn’t return that post. It may have been deleted, or the account may be private or suspended.',
    );
  }
  const chain = [focal];
  let parentId = focal.legacy.in_reply_to_status_id_str;
  while (parentId && tweets.has(parentId) && chain.length <= MAX_CHAIN) {
    const parent = tweets.get(parentId);
    chain.unshift(parent);
    parentId = parent.legacy.in_reply_to_status_id_str;
  }
  return chain.map((tweet) => twitterToPost(tweet));
}
