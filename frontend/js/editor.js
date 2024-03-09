import axios from 'axios';
import { DateTime } from 'luxon';
import '../../css/feed-editor.css';
import { editorToolConfig } from './helpers/editorConfig.js';
import {
  NETWORK_LIMITS,
  debouncedUpdateDelimiters,
  getSlugFromTitle,
  parseAndInsertDelimiters,
  socialLinksToArray,
  socialLinksToMap,
  updateDelimiters,
} from './helpers/editorHelpers.js';

import EditorJS from '@editorjs/editorjs';
import SocialPostDelimiter from './SocialPostDelimiter.js';

import debounce from 'lodash.debounce';
import TomSelect from 'tom-select';

const postMeta = {
  title: '',
  slug: DateTime.now().toFormat('yyyyMMddHHmm'),
  tags: [],
  relatedPost: null,
  relatedPostModel: null,
  id: null,
  socialLinks: {},
};
const editors = {
  primary: null,
  twitter: null,
  mastodon: null,
  bluesky: null,
};
const validation = {
  twitter: true,
  mastodon: true,
  bluesky: true,
};
let savedPost = {};
let tagSelect;
let relatedPostsSelect;
let socialPostsCheckbox;
let saveButton;
let deleteButton;

// Change handlers -------------------------------------------------------------------------------
/**
 * When the title changes:
 *  - Autogenerate the new slug if it's not manually set.
 *  - Update the postMeta.slug
 *  - Update the postMeta.title
 */
function onTitleChange() {
  const slugElement = document.getElementById('slug');
  if (postMeta.slug === getSlugFromTitle(postMeta.title)) {
    postMeta.slug = getSlugFromTitle(this.value);
    slugElement.value = postMeta.slug;
  }
  postMeta.title = this.value;
}
const debouncedOnTitleChange = debounce(onTitleChange, 250);

/**
 * Update the postMeta.slug when the title changes
 */
function onSlugChange() {
  postMeta.slug = this.value;
}
const debouncedOnSlugChange = debounce(onSlugChange, 250);

/**
 * Toggle the social post editors when the social post checkbox is toggled.
 * This initializes the editors if they've not already been initialized; otherwise, it shows/hides them.
 * This also handles taking care of the initial post validation to determine if the social posts can be saved.
 * @param {Event} evt
 */
async function toggleSocialPosts({ target: { checked } }) {
  const editorsWrapper = document.querySelector('.social-editors');
  if (checked) {
    editorsWrapper.classList.remove('hidden');

    // Initialize once
    if (!editors.twitter) {
      const post = await editors.primary.save();
      for (const network of ['twitter', 'mastodon', 'bluesky']) {
        const postWithDelimiters = parseAndInsertDelimiters(post, network);
        editors[network] = new EditorJS({
          holder: `${network}-editor`,
          tools: {
            ...editorToolConfig,
            socialPostDelimiter: {
              class: SocialPostDelimiter,
              config: {
                limit: NETWORK_LIMITS[network].post,
              },
            },
          },
          onChange: async (api) => {
            const post = await api.saver.save();
            validation[network] = debouncedUpdateDelimiters(
              editors[network],
              post,
              network,
              network === 'mastodon'
                ? document.getElementById('mastodon-tags').value
                : null,
            );
            validate();
          },
          data: postWithDelimiters,
        });

        // Check initial validity
        validation[network] = postWithDelimiters.blocks.every(
          (block) =>
            block.type !== 'socialPostDelimiter' ||
            block.data.limitExceeded === false,
        );
      }
      validate();
    }
  } else {
    editorsWrapper.classList.add('hidden');
    saveButton.removeAttribute('disabled');
  }
}
/**
 * Toggle whether the post will be posted to a given network, then revalidate.
 * @param {Event} evt
 */
function toggleSocialPostForNetwork(evt) {
  const network = evt.target.id.split('-')[0];
  if (!evt.target.checked) {
    document.getElementById(`${network}-editor`).classList.add('hidden');
  } else {
    document.getElementById(`${network}-editor`).classList.remove('hidden');
  }
  validate();
}

/**
 * Update the postMeta.socialLinks when the social post link changes
 */
function onSocialPostLinkChange() {
  if (this.value) {
    postMeta.socialLinks[this.id] = this.value;
  } else {
    delete postMeta.socialLinks[this.id];
  }
}
const debouncedOnSocialChange = debounce(onSocialPostLinkChange, 250);

// Helpers to keep form in sync with DB after save ----------------------------------------------
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
  postMeta.relatedPost = data.relatedPost;
  postMeta.relatedPostModel = data.relatedPostModel;
  postMeta.socialLinks = socialLinksToMap(data.socialLinks);
}

/**
 * Set the form inputs to the values in the postMeta copy.
 */
function setInputValues() {
  const titleEl = document.getElementById('title');
  const slugEl = document.getElementById('slug');
  const lastEdited = document.getElementById('last-edited');

  titleEl.value = postMeta.title;
  slugEl.value = postMeta.slug;
  tagSelect.setValue(postMeta.tags);
  relatedPostsSelect.setValue(postMeta.relatedPost);
  Object.entries(postMeta.socialLinks).forEach(([key, value]) => {
    document.getElementById(key).value = value;
  });
  if (savedPost.updatedAt) {
    slugEl.setAttribute('disabled', true);
    lastEdited.textContent = `Last edited: ${DateTime.fromISO(savedPost.updatedAt).toLocaleString(DateTime.DATETIME_FULL)}`;
  }
}

// Validate ---------------------------------------------------------------------------------------
/**
 * Validate the social posts and enable/disable the save button accordingly.
 */
function validate() {
  const isValid = Object.entries(validation).every(
    ([network, value]) =>
      // Check that each entry is either valid OR not selected to be posted
      value || !document.getElementById(`${network}-social`).checked,
  );
  if (!isValid) {
    saveButton.setAttribute('disabled', true);
  } else {
    saveButton.removeAttribute('disabled');
  }
}

// Social helpers --------------------------------------------------------------------------------
/**
 * Get the content of a social post editor.
 * @param {string} network
 * @returns {Promise<null|Object>}
 */
async function getSocialPostContent(network) {
  if (!document.getElementById(`${network}-social`).checked) {
    return null;
  }
  const resp = {};
  if (network === 'mastodon') {
    resp.tags = document.getElementById('mastodon-tags').value;
  }
  const post = await editors[network].save();
  resp.blocks = post.blocks;
  return resp;
}

/**
 * Update delimiters based on Mastodon tag change and revalidate, since it affects character count.
 * @param {Event} evt
 */
async function onMastodonTagsChange(evt) {
  // Use the non-debounced update since this function is debounced.
  const post = await editors.mastodon.save();
  validation.mastodon = await updateDelimiters(
    editors.mastodon,
    post,
    'mastodon',
    evt.target.value,
  );
  validate();
}
const debouncedOnMastodonTagsChange = debounce(onMastodonTagsChange, 250);

// Save -------------------------------------------------------------------------------------------
/**
 * Save the post and send social posts (if enabled).
 */
function save() {
  saveButton.setAttribute('disabled', true);
  editors.primary.save().then(async (savedData) => {
    // Select update or create endpoint
    const endpoint = savedPost._id
      ? `/dynamic-api/micro/entry/${savedPost._id}`
      : '/dynamic-api/micro/entry';
    const transformedPostMeta = {
      ...postMeta,
      socialLinks: socialLinksToArray(postMeta.socialLinks),
    };

    // Update or create micro post
    const promises = [
      axios.post(endpoint, {
        ...transformedPostMeta,
        post: savedData,
      }),
    ];

    // If social posts are enabled, also hit the social endpoint
    if (socialPostsCheckbox.checked) {
      const [twitter, mastodon, bluesky] = await Promise.all([
        getSocialPostContent('twitter'),
        getSocialPostContent('mastodon'),
        getSocialPostContent('bluesky'),
      ]);
      promises.push(
        axios.post('/dynamic-api/micro/social', {
          twitter,
          mastodon,
          bluesky,
        }),
      );
    }

    // Wait for the post and social post promises to resolve
    Promise.all(promises)
      .then(([postResp, socialResp]) => {
        // Hit the tags endpoint to fetch new tags with their IDs
        const tagsPromise = axios.get('/dynamic-api/tags');

        let postPromise;
        if (socialResp) {
          // Update the post again with the social post links
          postPromise = axios.post(
            `/dynamic-api/micro/entry/${postResp.data._id}`,
            {
              ...transformedPostMeta,
              socialLinks: socialLinksToArray(socialResp.data),
            },
          );
        } else {
          postPromise = Promise.resolve(postResp);
        }

        // Pass the post and tags responses to the next block
        return Promise.all([postPromise, tagsPromise]);
      })
      .then(([postResp, tags]) => {
        // Update tags select
        tagSelect.clearOptions();
        tagSelect.addOptions(tags.data);

        // Update postMeta and form to reflect backend changes
        updateModelFromDb(postResp.data);
        setInputValues();

        deleteButton.classList.remove('hidden');
        // Re-enable save button
        saveButton.removeAttribute('disabled');

        // Add slug to URL now that the post has been created
        window.history.pushState(
          {},
          null,
          `/micro/editor/${postResp.data.slug}`,
        );
      });
  });
}

// Delete -----------------------------------------------------------------------------------------
/**
 * Delete a saved post.
 */
function deletePost() {
  deleteButton.setAttribute('disabled', true);
  axios.delete(`/dynamic-api/micro/entry/${savedPost._id}`).then(() => {
    window.location = '/feed';
  });
}

// On first load --------------------------------------------------------------------------------
async function onFirstLoad() {
  // Load post data if we're editing an existing post
  const slug = window.location.pathname.split('/').slice(3);
  if (slug.length) {
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

  // Load editor
  editors.primary = new EditorJS({
    holder: 'editorjs',
    autofocus: true,
    tools: {
      ...editorToolConfig,
      socialPostDelimiter: {
        class: SocialPostDelimiter,
        config: {
          limit: null,
        },
      },
    },
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
  });

  // Load TomSelect for related posts
  const { data: relatedOptions } = await axios.get(
    '/dynamic-api/micro/relatedPosts',
  );
  relatedPostsSelect = new TomSelect('#related', {
    items: postMeta.relatedPost,
    valueField: '_id',
    labelField: 'title',
    searchField: ['title'],
    options: relatedOptions,
    allowEmptyOption: true,
  });

  // Selectors
  const titleEl = document.getElementById('title');
  const slugEl = document.getElementById('slug');
  socialPostsCheckbox = document.getElementById('social-posts');
  const mastodonTags = document.getElementById('mastodon-tags');
  saveButton = document.getElementById('save-button');
  deleteButton = document.getElementById('delete-button');

  // Set initial values
  setInputValues();

  // Attach handlers
  titleEl.addEventListener('keydown', debouncedOnTitleChange);
  slugEl.addEventListener('keydown', debouncedOnSlugChange);
  socialPostsCheckbox.addEventListener('change', toggleSocialPosts);
  document
    .querySelectorAll('.social-network-toggle')
    .forEach((el) => el.addEventListener('change', toggleSocialPostForNetwork));
  mastodonTags.addEventListener('keydown', debouncedOnMastodonTagsChange);

  document
    .querySelectorAll('.social-post-id')
    .forEach((el) => el.addEventListener('keydown', debouncedOnSocialChange));

  // TomSelect uses .on instead of .addEventListener, attach those handlers
  tagSelect.on('change', function (value) {
    if (value) {
      postMeta.tags = value.split(',');
    } else {
      postMeta.tags = [];
    }
  });
  relatedPostsSelect.on('change', function (value) {
    if (value) {
      postMeta.relatedPost = value;
      postMeta.relatedPostModel = relatedOptions.find(
        (opt) => opt._id === value,
      ).type;
    } else {
      postMeta.relatedPost = null;
      postMeta.relatedPostModel = null;
    }
  });

  saveButton.addEventListener('click', save);
  deleteButton.addEventListener('click', deletePost);
  if (savedPost._id) {
    deleteButton.classList.remove('hidden');
  }

  // Ready
  document.getElementById('loading-overlay').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', onFirstLoad);
