import axios from 'axios';
import { DateTime } from 'luxon';
import '../../css/feed-editor.css';
import { editorToolConfig } from './helpers/editorConfig.js';
import {
  NETWORK_LIMITS,
  getSlugFromTitle,
  parseAndInsertDelimiters,
  socialLinksToArray,
  socialLinksToMap,
  updateDelimiters,
} from './helpers/editorHelpers.js';

import EditorJS from '@editorjs/editorjs';
import SocialPostDelimiter from './SocialPostDelimiter.js';
import { NETWORK_LABELS } from '../../api/helpers/socialMedia.js';
import { createAboutPicker, createThreadPicker } from './helpers/pickers.js';

import debounce from 'lodash.debounce';
import TomSelect from 'tom-select';

const SOCIAL_NETWORKS = ['bluesky', 'mastodon', 'twitter'];

const postMeta = {
  title: '',
  slug: DateTime.now().toFormat('yyyyMMddHHmm'),
  tags: [],
  relatedPosts: [], // [{ ref, model }]
  threads: [], // Stored on the feed entry
  about: [], // Stored on the feed entry
  id: null,
  socialLinks: {},
};
const editors = {
  primary: null,
  twitter: null,
  mastodon: null,
  bluesky: null,
};
// Per network: number of posts in its thread, and whether every post fits the limit.
const socialSummary = Object.fromEntries(
  SOCIAL_NETWORKS.map((network) => [network, { posts: 0, ok: true }]),
);
// Local helper that composes Twitter posts in a browser (see backend/scripts/xComposeHelper.js)
const X_HELPER_URL = 'http://localhost:5055';

let savedPost = {};
let tagSelect;
let relatedPostsSelect;
let threadPicker;
let aboutPicker;
let saveButton;
let deleteButton;

const isSaved = () => Boolean(savedPost._id);
const isCrosspostEnabled = (network) =>
  document.getElementById(`${network}-social`).checked;

// Title and slug ---------------------------------------------------------------------------------
/**
 * Keep the slug following the title until it's set by hand, then store the title.
 */
function onTitleChange() {
  const slugElement = document.getElementById('slug');
  if (!isSaved() && postMeta.slug === getSlugFromTitle(postMeta.title)) {
    postMeta.slug = getSlugFromTitle(this.value);
    slugElement.value = postMeta.slug;
    document.getElementById('slug-display').textContent = postMeta.slug;
  }
  postMeta.title = this.value;
}
const debouncedOnTitleChange = debounce(onTitleChange, 250);

function onSlugChange() {
  postMeta.slug = this.value;
  document.getElementById('slug-display').textContent = this.value;
}
const debouncedOnSlugChange = debounce(onSlugChange, 250);

// Tabs -------------------------------------------------------------------------------------------
/**
 * Show the post, one platform's thread, or all three side by side. Side by side hides the side
 * panel so the columns get the full width.
 * @param {string} tab "post", a network, or "side-by-side"
 */
async function showTab(tab) {
  for (const button of document.querySelectorAll('.editor-tab')) {
    button.setAttribute('aria-selected', String(button.dataset.tab === tab));
  }
  const isPost = tab === 'post';
  document.getElementById('panel-post').hidden = !isPost;
  document.getElementById('panel-social').hidden = isPost;
  document.body.classList.toggle('side-by-side', tab === 'side-by-side');
  for (const wrapper of document.querySelectorAll('.social-editor-wrapper')) {
    wrapper.hidden = tab !== 'side-by-side' && wrapper.dataset.network !== tab;
  }
  if (!isPost) {
    await ensureSocialEditors();
  }
}

// Social threads ---------------------------------------------------------------------------------
/**
 * Count the posts in a thread (each ends in a delimiter) and check them against the limit.
 * @param {Object[]} blocks
 */
function summarizeThread(blocks) {
  const delimiters = blocks.filter(
    (block) => block.type === 'socialPostDelimiter',
  );
  return {
    posts: delimiters.length,
    ok: delimiters.every((block) => !block.data.limitExceeded),
  };
}

function renderSocialSummary(network) {
  const { posts, ok } = socialSummary[network];
  document.getElementById(`${network}-count`).textContent = posts || '';
  const status = document.getElementById(`${network}-status`);
  status.textContent = posts
    ? `${posts} post${posts === 1 ? '' : 's'} · ${ok ? 'ok' : 'over limit'}`
    : '';
  status.classList.toggle('over-limit', !ok);
}

/**
 * Until a platform's thread editor exists, its summary comes from splitting the main post.
 */
async function summarizeFromMainPost() {
  const post = await editors.primary.save();
  for (const network of SOCIAL_NETWORKS) {
    if (!editors[network]) {
      socialSummary[network] = summarizeThread(
        parseAndInsertDelimiters(post, network).blocks,
      );
      renderSocialSummary(network);
    }
  }
  validate();
}

function mastodonTags() {
  return document.getElementById('mastodon-tags').value;
}

/**
 * Recount a platform thread's characters per post, update its delimiters, and revalidate.
 * @param {string} network
 */
async function recheckThread(network) {
  const post = await editors[network].save();
  const ok = updateDelimiters(
    editors[network],
    post,
    network,
    network === 'mastodon' ? mastodonTags() : null,
  );
  socialSummary[network] = { posts: summarizeThread(post.blocks).posts, ok };
  renderSocialSummary(network);
  validate();
}
// One debounced check per network, so edits to two threads in quick succession both get checked.
const debouncedRecheck = Object.fromEntries(
  SOCIAL_NETWORKS.map((network) => [
    network,
    debounce(() => recheckThread(network), 500),
  ]),
);

/**
 * Create the platform thread editors from the main post, once. They're edited separately after
 * that; changes to the main post don't flow into them.
 */
let socialEditorsReady;
function ensureSocialEditors() {
  if (!socialEditorsReady) {
    socialEditorsReady = (async () => {
      const post = await editors.primary.save();
      await Promise.all(
        SOCIAL_NETWORKS.map((network) => {
          const postWithDelimiters = parseAndInsertDelimiters(post, network);
          editors[network] = new EditorJS({
            holder: `${network}-editor`,
            tools: {
              ...editorToolConfig,
              socialPostDelimiter: {
                class: SocialPostDelimiter,
                config: { limit: NETWORK_LIMITS[network].post },
              },
            },
            onChange: () => debouncedRecheck[network](),
            data: postWithDelimiters,
          });
          socialSummary[network] = summarizeThread(postWithDelimiters.blocks);
          renderSocialSummary(network);
          return editors[network].isReady;
        }),
      );
      validate();
    })();
  }
  return socialEditorsReady;
}

/**
 * The "all platforms" switch is on when every platform is ticked, off when none are, and mixed
 * in between.
 */
function syncAllToggle() {
  const enabled = SOCIAL_NETWORKS.filter(isCrosspostEnabled);
  const allToggle = document.getElementById('crosspost-all');
  allToggle.checked = enabled.length === SOCIAL_NETWORKS.length;
  allToggle.indeterminate =
    enabled.length > 0 && enabled.length < SOCIAL_NETWORKS.length;
}

async function setAllCrossposting(enabled) {
  for (const network of SOCIAL_NETWORKS) {
    document.getElementById(`${network}-social`).checked = enabled;
  }
  syncAllToggle();
  if (enabled) {
    await ensureSocialEditors();
  }
  validate();
}

/**
 * Before posting somewhere this post is already on, ask: post again, save without re-posting
 * there, or cancel the save.
 * @param {string[]} networks Ticked networks the post already has links for
 * @returns {Promise<'repost'|'skip'|'cancel'>}
 */
function confirmRepost(networks) {
  const dialog = document.getElementById('repost-dialog');
  document.getElementById('repost-networks').textContent = networks
    .map((network) => NETWORK_LABELS[network])
    .join(' and ');
  return new Promise((resolve) => {
    dialog.addEventListener(
      'close',
      () =>
        resolve(
          ['repost', 'skip'].includes(dialog.returnValue)
            ? dialog.returnValue
            : 'cancel', // Includes closing with Escape
        ),
      { once: true },
    );
    dialog.returnValue = '';
    dialog.showModal();
  });
}

/**
 * Update postMeta.socialLinks when a manually entered post ID changes
 */
function onSocialPostLinkChange() {
  if (this.value) {
    postMeta.socialLinks[this.id] = this.value;
  } else {
    delete postMeta.socialLinks[this.id];
  }
}
const debouncedOnSocialChange = debounce(onSocialPostLinkChange, 250);

// Word count -------------------------------------------------------------------------------------
async function updateWordCount() {
  const post = await editors.primary.save();
  const text = post.blocks
    .map((block) => block.data?.text || '')
    .join(' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  document.getElementById('word-count').textContent =
    `${words} word${words === 1 ? '' : 's'}`;
}

const debouncedOnPrimaryChange = debounce(() => {
  updateWordCount();
  summarizeFromMainPost();
}, 500);

// Keep the form in sync with the database after a save -------------------------------------------
/**
 * Save relevant data from the backend to the postMeta copy.
 * @param {Object} data
 */
function updateModelFromDb(data) {
  savedPost = data;
  postMeta.title = data.title;
  postMeta.slug = data.slug;
  postMeta.tags = data.tags;
  postMeta.id = data.id;
  // Related posts come populated with titles; a null ref is a post that's since been deleted.
  postMeta.relatedPosts = (data.relatedPosts || [])
    .filter(({ ref }) => ref)
    .map(({ ref, model }) => ({ ref: ref._id, model }));
  postMeta.threads = (data.feed?.threads || []).map(({ _id }) => _id);
  postMeta.about = (data.feed?.about || []).map(({ _id }) => _id);
  postMeta.socialLinks = socialLinksToMap(data.socialLinks);
}

function formatSavedTime(iso) {
  const time = DateTime.fromISO(iso);
  const sameDay = time.hasSame(DateTime.now(), 'day');
  const formatted = sameDay
    ? time.toFormat('h:mm a')
    : time.toFormat('LLL d, h:mm a');
  return `saved ${formatted.replace('AM', 'am').replace('PM', 'pm')}`;
}

/**
 * Set the form inputs to the values in the postMeta copy.
 */
function setInputValues() {
  document.getElementById('title').value = postMeta.title;
  document.getElementById('slug').value = postMeta.slug;
  document.getElementById('slug-display').textContent = postMeta.slug;
  tagSelect.setValue(postMeta.tags);
  relatedPostsSelect.setValue(postMeta.relatedPosts.map(({ ref }) => ref));
  threadPicker.setValue(postMeta.threads, true);
  aboutPicker.setValue(postMeta.about, true);
  Object.entries(postMeta.socialLinks).forEach(([key, value]) => {
    document.getElementById(key).value = value;
  });

  // Once saved, the slug is the post's permanent address.
  if (isSaved()) {
    document.getElementById('slug').hidden = true;
    document.getElementById('slug-edit').hidden = true;
    document.getElementById('editing-label').textContent = 'editing post';
    document.getElementById('last-saved').textContent = formatSavedTime(
      savedPost.updatedAt,
    );
    const preview = document.getElementById('preview-link');
    preview.href = `/micro/entry/${savedPost.slug}`;
    preview.hidden = false;
    saveButton.textContent = 'Save';
    deleteButton.hidden = false;
  }
}

// Validate ---------------------------------------------------------------------------------------
/**
 * Saving is blocked while a platform that's ticked for cross-posting has a post over its limit.
 */
function validate() {
  const isValid = SOCIAL_NETWORKS.every(
    (network) => socialSummary[network].ok || !isCrosspostEnabled(network),
  );
  saveButton.disabled = !isValid;
}

// Social helpers --------------------------------------------------------------------------------
/**
 * Get the content of a social post editor.
 * @param {string} network
 * @returns {Promise<null|Object>}
 */
async function getSocialPostContent(network) {
  if (!isCrosspostEnabled(network)) {
    return null;
  }
  const resp = {};
  if (network === 'mastodon') {
    let tags = mastodonTags();
    if (tags) {
      tags = tags.split(/, ?/g);
      resp.tags = tags
        .map((tag) => {
          let trimmed = tag.trim();
          if (!tag.startsWith('#')) {
            return `#${trimmed}`;
          }
          return trimmed;
        })
        .join(' ');
    }
  }
  const post = await editors[network].save();
  resp.blocks = post.blocks;
  return resp;
}

/**
 * Send a Twitter thread to the local X compose helper (backend/scripts/xComposeHelper.js), which
 * fills it in on x.com and waits for the post to be made by hand. Never rejects: failures are
 * returned as { error } so they don't prevent the other networks' results from being saved.
 * @param {Object} twitter Social post content, as returned by getSocialPostContent
 * @returns {Promise<{postId?: string, error?: string}>}
 */
async function composeOnX(twitter) {
  try {
    const resp = await axios.post(`${X_HELPER_URL}/compose`, {
      blocks: twitter.blocks,
    });
    for (const warning of resp.data.warnings || []) {
      console.warn(warning);
    }
    return { postId: resp.data.postId };
  } catch (err) {
    if (!err.response) {
      return {
        error: `Couldn't reach the X compose helper at ${X_HELPER_URL}. Is \`npm run x-helper\` running on this computer?`,
      };
    }
    return { error: err.response.data?.error || err.message };
  }
}

// Save -------------------------------------------------------------------------------------------
/**
 * Save the post, and cross-post to the platforms that are ticked.
 */
async function save() {
  saveButton.disabled = true;
  try {
    const alreadyPosted = SOCIAL_NETWORKS.filter(
      (network) => isCrosspostEnabled(network) && postMeta.socialLinks[network],
    );
    if (alreadyPosted.length) {
      const choice = await confirmRepost(alreadyPosted);
      if (choice === 'cancel') {
        return;
      }
      if (choice === 'skip') {
        for (const network of alreadyPosted) {
          document.getElementById(`${network}-social`).checked = false;
        }
        syncAllToggle();
      }
    }

    const savedData = await editors.primary.save();
    if (SOCIAL_NETWORKS.some(isCrosspostEnabled)) {
      await ensureSocialEditors();
    }

    // Select update or create endpoint
    const endpoint = isSaved()
      ? `/dynamic-api/micro/entry/${savedPost._id}`
      : '/dynamic-api/micro/entry';
    const transformedPostMeta = {
      ...postMeta,
      socialLinks: socialLinksToArray(postMeta.socialLinks),
    };

    const [twitter, mastodon, bluesky] = await Promise.all(
      ['twitter', 'mastodon', 'bluesky'].map(getSocialPostContent),
    );
    const [postResp, socialResult] = await Promise.all([
      axios.post(endpoint, { ...transformedPostMeta, post: savedData }),
      mastodon || bluesky || twitter
        ? Promise.all([
            mastodon || bluesky
              ? axios
                  .post('/dynamic-api/micro/social', { mastodon, bluesky })
                  .then((resp) => resp.data)
              : { postIds: {}, errors: {} },
            twitter ? composeOnX(twitter) : null,
          ]).then(([serverResult, xResult]) => ({
            postIds: {
              ...serverResult.postIds,
              ...(xResult?.postId ? { twitter: xResult.postId } : {}),
            },
            errors: {
              ...serverResult.errors,
              ...(xResult?.error ? { twitter: xResult.error } : {}),
            },
          }))
        : null,
    ]);

    let finalResp = postResp;
    if (socialResult) {
      const { postIds, errors } = socialResult;
      const failedNetworks = Object.entries(errors);
      if (failedNetworks.length) {
        window.alert(
          'Some social posts failed:\n\n' +
            failedNetworks
              .map(([network, message]) => `${network}: ${message}`)
              .join('\n'),
        );
      }
      // Posted networks are unticked, so saving again doesn't post them twice.
      for (const network of Object.keys(postIds)) {
        document.getElementById(`${network}-social`).checked = false;
      }
      syncAllToggle();

      // Update the post again with the social post links, keeping any existing links for
      // networks that weren't posted to (or failed).
      finalResp = await axios.post(
        `/dynamic-api/micro/entry/${postResp.data._id}`,
        {
          ...transformedPostMeta,
          // New tags were created by the first save; send their IDs, not their names again.
          tags: postResp.data.tags,
          socialLinks: socialLinksToArray({
            ...postMeta.socialLinks,
            ...postIds,
          }),
        },
      );
    }

    // Refresh tag options so newly created tags show with their IDs.
    const { data: allTags } = await axios.get('/dynamic-api/tags');
    tagSelect.clearOptions();
    tagSelect.addOptions(allTags);

    updateModelFromDb(finalResp.data);
    setInputValues();

    // Add slug to URL now that the post has been created
    window.history.pushState({}, null, `/micro/editor/${finalResp.data.slug}`);
  } catch (err) {
    console.error(err);
    // The entry routes return the raw error object, so only use the response body if it's a
    // readable string.
    const responseError = err?.response?.data?.error;
    const message =
      typeof responseError === 'string'
        ? responseError
        : err?.message || String(err);
    window.alert(`Failed to save: ${message}`);
  } finally {
    validate();
  }
}

// Delete -----------------------------------------------------------------------------------------
function deletePost() {
  if (!window.confirm('Delete this post?')) {
    return;
  }
  deleteButton.disabled = true;
  axios.delete(`/dynamic-api/micro/entry/${savedPost._id}`).then(() => {
    window.location = '/feed';
  });
}

async function signOut() {
  await axios.post('/dynamic-api/auth/logout');
  window.location = '/micro/login';
}

// On first load --------------------------------------------------------------------------------
async function onFirstLoad() {
  // Load post data if we're editing an existing post
  let slug = window.location.pathname.split('/').slice(3);
  if (slug.length && slug[0] !== '') {
    slug = slug[0];
    try {
      const resp = await axios.get(`/dynamic-api/micro/entry/${slug}`);
      if (resp) {
        updateModelFromDb(resp.data);
      } else {
        throw new Error('No post found');
      }
    } catch (err) {
      if (err && err.response && err.response.status === 404) {
        document.querySelector('#error-overlay .error-message').textContent =
          `No post with the slug "${slug}" was found.`;
        document.getElementById('loading-overlay').classList.add('hidden');
        document.getElementById('error-overlay').classList.remove('hidden');
        return;
      }
      throw err;
    }
  }

  saveButton = document.getElementById('save-button');
  deleteButton = document.getElementById('delete-button');

  // Load editor
  editors.primary = new EditorJS({
    holder: 'editorjs',
    autofocus: true,
    placeholder: 'Tab or + to add a block',
    tools: {
      ...editorToolConfig,
      socialPostDelimiter: {
        class: SocialPostDelimiter,
        config: {
          limit: null,
        },
      },
    },
    onChange: () => debouncedOnPrimaryChange(),
    data: savedPost.post || {},
  });

  // Load TomSelect for tags editor
  const { data: tagOptions } = await axios.get('/dynamic-api/tags');
  tagSelect = new TomSelect('#tags', {
    create: true,
    items: postMeta.tags,
    valueField: '_id',
    searchField: ['text'],
    options: tagOptions,
    maxOptions: null,
    closeAfterSelect: true,
    placeholder: 'add tag',
  });

  // Load TomSelect for related posts
  const { data: relatedOptions } = await axios.get(
    '/dynamic-api/micro/relatedPosts',
  );
  // Recent options don't necessarily include this post's current related posts, so add those.
  const currentRelated = (savedPost.relatedPosts || [])
    .filter(({ ref }) => ref)
    .map(({ ref, model }) => ({ _id: ref._id, title: ref.title, type: model }));
  const allRelatedOptions = [
    ...currentRelated,
    ...relatedOptions.filter(
      (opt) => !currentRelated.some((current) => current._id === opt._id),
    ),
  ];
  relatedPostsSelect = new TomSelect('#related', {
    items: postMeta.relatedPosts.map(({ ref }) => ref),
    valueField: '_id',
    labelField: 'title',
    searchField: ['title'],
    options: allRelatedOptions,
    maxItems: null,
    placeholder: 'search your posts',
  });

  threadPicker = await createThreadPicker('#threads', {
    initial: savedPost.feed?.threads || [],
    preview: document.getElementById('threads-preview'),
    getPosition: () => ({
      at: savedPost.feed?.createdAt,
      feedEntryId: savedPost.feed?._id,
    }),
    onChange: (ids) => {
      postMeta.threads = ids;
    },
  });
  aboutPicker = createAboutPicker('#about', {
    initial: savedPost.feed?.about || [],
    onChange: (ids) => {
      postMeta.about = ids;
    },
  });

  // Platform limits shown in each thread's heading
  for (const network of SOCIAL_NETWORKS) {
    document.getElementById(`${network}-limit`).textContent =
      `${NETWORK_LIMITS[network].post.toLocaleString()} per post`;
  }

  // Set initial values
  setInputValues();

  // Attach handlers
  const titleEl = document.getElementById('title');
  const slugEl = document.getElementById('slug');
  titleEl.addEventListener('input', debouncedOnTitleChange);
  slugEl.addEventListener('input', debouncedOnSlugChange);
  document.getElementById('slug-edit').addEventListener('click', () => {
    slugEl.hidden = false;
    slugEl.focus();
  });
  document.querySelector('.editor-tabs').addEventListener('click', (evt) => {
    const tab = evt.target.closest('.editor-tab')?.dataset.tab;
    if (tab) {
      showTab(tab).catch(console.error);
    }
  });
  for (const toggle of document.querySelectorAll('.crosspost-toggle')) {
    toggle.addEventListener('change', async () => {
      syncAllToggle();
      if (toggle.checked) {
        await ensureSocialEditors();
      }
      validate();
    });
  }
  const allToggle = document.getElementById('crosspost-all');
  allToggle.addEventListener('change', () =>
    setAllCrossposting(allToggle.checked).catch(console.error),
  );
  // New posts cross-post everywhere by default. Existing posts start with nothing ticked, so
  // editing an old post never posts it by accident.
  if (!isSaved()) {
    for (const network of SOCIAL_NETWORKS) {
      document.getElementById(`${network}-social`).checked = true;
    }
  }
  syncAllToggle();
  document
    .getElementById('mastodon-tags')
    .addEventListener('input', () => debouncedRecheck.mastodon());

  document
    .querySelectorAll('.social-post-id')
    .forEach((el) => el.addEventListener('input', debouncedOnSocialChange));

  // TomSelect uses .on instead of .addEventListener, attach those handlers
  tagSelect.on('change', function (value) {
    if (value) {
      postMeta.tags = value.split(',');
    } else {
      postMeta.tags = [];
    }
  });
  relatedPostsSelect.on('change', function () {
    postMeta.relatedPosts = relatedPostsSelect.getValue().map((id) => ({
      ref: id,
      model: allRelatedOptions.find((opt) => opt._id === id).type,
    }));
  });

  saveButton.addEventListener('click', save);
  deleteButton.addEventListener('click', deletePost);
  document.getElementById('signOut').addEventListener('click', signOut);

  // Initial counts once the editor has loaded the post
  await editors.primary.isReady;
  await Promise.all([updateWordCount(), summarizeFromMainPost()]);

  // Ready
  document.getElementById('loading-overlay').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', onFirstLoad);
