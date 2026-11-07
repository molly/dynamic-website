import axios from 'axios';
import { parsePostUrl } from '../../api/helpers/postUrl.js';

// Look up a public post on Bluesky or Mastodon: who wrote it and when. Twitter has no public API,
// so only what the URL itself says is returned. Used for "in reply to"; the social post block will
// build on it.

const config = {
  timeout: 10000,
  headers: {
    'User-Agent':
      'mollywhite.net editor (https://github.com/molly/dynamic-website)',
  },
};
const BSKY_API = 'https://public.api.bsky.app/xrpc';

async function fetchBluesky({ handle, rkey }) {
  const did = handle.startsWith('did:')
    ? handle
    : (
        await axios.get(`${BSKY_API}/com.atproto.identity.resolveHandle`, {
          ...config,
          params: { handle },
        })
      ).data.did;
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
  return {
    name: post.author.displayName || post.author.handle,
    handle: post.author.handle,
    postedAt: post.record?.createdAt || post.indexedAt,
  };
}

async function fetchMastodon({ host, id }) {
  const { data } = await axios.get(
    `https://${host}/api/v1/statuses/${id}`,
    config,
  );
  return {
    name: data.account.display_name || data.account.username,
    handle: data.account.acct,
    postedAt: data.created_at,
  };
}

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
    return { ...base, ...(await fetchBluesky(parsed)) };
  }
  if (parsed.network === 'mastodon') {
    return { ...base, ...(await fetchMastodon(parsed)) };
  }
  return { ...base, handle: parsed.handle };
}
