import axios from 'axios';
import { DateTime } from 'luxon';
import '../../css/feed-editor.css';
import { editorToolConfig } from './helpers/editorConfig.js';
import {
  getSlugFromTitle,
  socialLinksToArray,
  socialLinksToMap,
} from './helpers/editorHelpers.js';

import EditorJS from '@editorjs/editorjs';
import SocialPostDelimiter from './SocialPostDelimiter.js';
import { NETWORK_LABELS } from '../../api/helpers/socialMedia.js';
import {
  createAboutPicker,
  createEntryPicker,
  createThreadPicker,
} from './helpers/pickers.js';
import { ArchivePanel } from './archivePanel.js';
import { suggestBetweenTagsAndAbout } from './helpers/tagSuggestions.js';
import {
  DataField,
  LiveField,
  ReplyField,
  SourcesField,
} from './metadata/metadataFields.js';
import { UpdatesEditor } from './metadata/updatesEditor.js';
import { X_HELPER_UNREACHABLE, X_HELPER_URL } from './helpers/xHelper.js';
import { SOCIAL_NETWORKS, ThreadEditors } from './threads/threadEditor.js';

import debounce from 'lodash.debounce';
import TomSelect from 'tom-select';

const postMeta = {
  title: '',
  slug: DateTime.now().toFormat('yyyyMMddHHmm'),
  tags: [],
  relatedPosts: [], // [{ ref, model }]
  threads: [], // Stored on the feed entry
  about: [], // Stored on the feed entry
  related: [], // Related entries, in order; stored on the feed entry
  id: null,
  socialLinks: {},
};
const editors = {
  primary: null,
};

let savedPost = {};
let tagSelect;
let relatedPostsSelect;
let threadPicker;
let aboutPicker;
let relatedEntriesPicker;
let saveButton;
let deleteButton;
let threadEditors;
let archivePanel;
let updatesEditor;
const metadata = {}; // The side panel's sources, data, inReplyTo and live fields

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
function showTab(tab) {
  for (const button of document.querySelectorAll('.editor-tab')) {
    button.setAttribute('aria-selected', String(button.dataset.tab === tab));
  }
  const isPost = tab === 'post';
  const isPlatform = SOCIAL_NETWORKS.includes(tab);
  document.getElementById('panel-post').hidden = !isPost;
  document.getElementById('panel-social').hidden = isPost;
  document.getElementById('platform-thread').hidden = !isPlatform;
  document.getElementById('side-by-side').hidden = tab !== 'side-by-side';
  document.getElementById('post-panel').hidden = !isPost;
  document.getElementById('platform-panel').hidden = !isPlatform;
  document.body.classList.toggle('side-by-side', tab === 'side-by-side');
  threadEditors.setView(isPost ? null : tab);
}

// Platform threads -------------------------------------------------------------------------------
/**
 * Post counts on the tabs, and each platform's status in the cross-post box.
 */
function renderSocialSummary() {
  for (const network of SOCIAL_NETWORKS) {
    const { posts, problems } = threadEditors.summary(network);
    document.getElementById(`${network}-count`).textContent = posts || '';
    const status = document.getElementById(`${network}-status`);
    status.textContent = posts
      ? `${posts} post${posts === 1 ? '' : 's'} · ${problems.length ? 'needs fixing' : 'ok'}`
      : '';
    status.title = problems.join('; ');
    status.classList.toggle('over-limit', problems.length > 0);
  }
  validate();
}

/**
 * Rebuild threads that haven't been edited from the current main post.
 */
async function syncThreadsWithMainPost() {
  await threadEditors.updateMainPost(await editors.primary.save());
  renderSocialSummary();
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

function setAllCrossposting(enabled) {
  for (const network of SOCIAL_NETWORKS) {
    document.getElementById(`${network}-social`).checked = enabled;
  }
  syncAllToggle();
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

// Links on the post as currently written, for the archive panel: the post's and its updates', and
// its sources, data and the post it replies to (even if not yet valid enough to save).
async function refreshArchivePanel() {
  const urls = [
    ...metadata.sources.readRows().map((s) => s.url),
    metadata.data.url.value.trim(),
    metadata.inReplyTo.url.value.trim(),
  ];
  const blocks = [
    ...threadEditors.mainPost.blocks,
    ...(await updatesEditor.blocks()),
  ];
  await archivePanel.refresh(blocks, urls);
}
const debouncedRefreshArchivePanel = debounce(
  () => refreshArchivePanel().catch(console.error),
  500,
);

const debouncedOnPrimaryChange = debounce(async () => {
  updateWordCount();
  updatesEditor.checkCorrections();
  await syncThreadsWithMainPost();
  refreshArchivePanel().catch(console.error);
}, 500);

/**
 * The post's metadata and updates as the save route takes them. Throws with a message for the
 * first field that can't be saved as it is.
 */
async function readMetadata() {
  return {
    sources: metadata.sources.getValue(),
    data: metadata.data.getValue(),
    inReplyTo: metadata.inReplyTo.getValue(),
    live: metadata.live.getValue(),
    updates: await updatesEditor.getValue(),
  };
}

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
  postMeta.related = (data.feed?.related || []).map(({ _id }) => _id);
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
  relatedEntriesPicker.addOptions(savedPost.feed?.related || []);
  relatedEntriesPicker.setValue(postMeta.related, true);
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
    (network) =>
      !isCrosspostEnabled(network) ||
      threadEditors.summary(network).problems.length === 0,
  );
  saveButton.disabled = !isValid;
}

// Social helpers --------------------------------------------------------------------------------
/**
 * A platform's thread as the cross-posting endpoints take it, if it's ticked.
 * @param {string} network
 * @returns {null|{posts: Object[], tags?: string}}
 */
function getSocialPostContent(network) {
  return isCrosspostEnabled(network) ? threadEditors.forPosting(network) : null;
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
      posts: twitter.posts,
    });
    for (const warning of resp.data.warnings || []) {
      console.warn(warning);
    }
    return { postId: resp.data.postId };
  } catch (err) {
    if (!err.response) {
      return { error: X_HELPER_UNREACHABLE };
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
    // Before anything is posted anywhere, so a field that can't be saved stops the whole save.
    const postMetadata = await readMetadata();
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

    // Select update or create endpoint
    const endpoint = isSaved()
      ? `/dynamic-api/micro/entry/${savedPost._id}`
      : '/dynamic-api/micro/entry';
    const transformedPostMeta = {
      ...postMeta,
      ...postMetadata,
      socialLinks: socialLinksToArray(postMeta.socialLinks),
      socialThreads: threadEditors.toSave(),
    };

    const [twitter, mastodon, bluesky] = ['twitter', 'mastodon', 'bluesky'].map(
      getSocialPostContent,
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

    // Archive the links that were ticked. Failing to queue them doesn't undo the save.
    archivePanel.queueChecked().catch((err) => {
      console.error(err);
      window.alert(
        `The post saved, but its links couldn't be queued for archiving: ${err.message}`,
      );
    });

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
  // #coinbase suggests @Coinbase for "about", and the other way round
  suggestBetweenTagsAndAbout({ tagSelect, aboutPicker });
  relatedEntriesPicker = createEntryPicker('#related-entries', {
    initial: savedPost.feed?.related || [],
    getExclude: () => savedPost.feed?._id,
    onChange: (ids) => {
      postMeta.related = ids;
    },
  });

  threadEditors = new ThreadEditors({
    saved: savedPost.socialThreads,
    onChange: renderSocialSummary,
    showTab,
  });
  threadEditors.attach();
  archivePanel = new ArchivePanel();

  updatesEditor = new UpdatesEditor({
    postHolder: document.getElementById('editorjs'),
    onChange: debouncedRefreshArchivePanel,
  });
  metadata.sources = new SourcesField({
    getBlocks: async () => [
      ...(await editors.primary.save()).blocks,
      ...(await updatesEditor.blocks()),
    ],
    onChange: debouncedRefreshArchivePanel,
  });
  metadata.data = new DataField({ onChange: debouncedRefreshArchivePanel });
  metadata.inReplyTo = new ReplyField({
    onChange: debouncedRefreshArchivePanel,
  });
  metadata.live = new LiveField({
    onToggle: (isLive) => updatesEditor.setLive(isLive),
  });
  // Set once: after a save these already match what was saved, and updates keep their ids.
  metadata.sources.setValue(savedPost.sources);
  metadata.data.setValue(savedPost.data);
  metadata.inReplyTo.setValue(savedPost.inReplyTo);
  metadata.live.setValue(savedPost.live);
  updatesEditor.setValue(savedPost.updates);

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
      showTab(tab);
    }
  });
  for (const toggle of document.querySelectorAll('.crosspost-toggle')) {
    toggle.addEventListener('change', () => {
      syncAllToggle();
      validate();
    });
  }
  const allToggle = document.getElementById('crosspost-all');
  allToggle.addEventListener('change', () =>
    setAllCrossposting(allToggle.checked),
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
  await Promise.all([updateWordCount(), syncThreadsWithMainPost()]);
  updatesEditor.checkCorrections();
  refreshArchivePanel().catch(console.error);

  // Ready
  document.getElementById('loading-overlay').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', onFirstLoad);
