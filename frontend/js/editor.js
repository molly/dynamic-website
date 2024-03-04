import axios from 'axios';
import { DateTime } from 'luxon';
import '../../css/feed-editor.css';
import {
  NETWORK_LIMITS,
  debouncedUpdateDelimiters,
  editorToolConfig,
  getSlugFromTitle,
  insertDelimiters,
  socialLinksToArray,
  socialLinksToMap,
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
let saveButton;

// Change handlers
function onTitleChange() {
  const slugElement = document.getElementById('slug');
  if (postMeta.slug === getSlugFromTitle(postMeta.title)) {
    postMeta.slug = getSlugFromTitle(this.value);
    slugElement.value = postMeta.slug;
  }
  postMeta.title = this.value;
}
const debouncedOnTitleChange = debounce(onTitleChange, 250);

function onSlugChange() {
  postMeta.slug = this.value;
}
const debouncedOnSlugChange = debounce(onSlugChange, 250);

async function toggleSocialPosts({ target: { checked } }) {
  const editorsWrapper = document.querySelector('.social-editors');
  if (checked) {
    editorsWrapper.classList.remove('hidden');

    // Initialize once
    if (!editors.twitter) {
      const post = await editors.primary.save();
      for (const network of ['twitter', 'mastodon', 'bluesky']) {
        const postWithDelimiters = insertDelimiters(post, network);
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
            validation[network] = await debouncedUpdateDelimiters(
              editors[network],
              api,
              network,
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

function onSocialChange() {
  if (this.value) {
    postMeta.socialLinks[this.id] = this.value;
  } else {
    delete postMeta.socialLinks[this.id];
  }
}
const debouncedOnSocialChange = debounce(onSocialChange, 250);

// Helpers to keep form in sync with DB after save
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

// Validate
function validate() {
  const isValid = Object.values(validation).every((v) => v);
  if (!isValid) {
    saveButton.setAttribute('disabled', true);
  } else {
    saveButton.removeAttribute('disabled');
  }
}

async function onFirstLoad() {
  // Load data
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
    tools: editorToolConfig,
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
  const socialPostsCheckbox = document.getElementById('social-posts');
  saveButton = document.getElementById('save-button');

  // Set initial values
  setInputValues();

  // Attach handlers
  titleEl.addEventListener('keydown', debouncedOnTitleChange);
  slugEl.addEventListener('keydown', debouncedOnSlugChange);
  socialPostsCheckbox.addEventListener('change', toggleSocialPosts);

  document
    .querySelectorAll('.social-post-id')
    .forEach((el) => el.addEventListener('keydown', debouncedOnSocialChange));

  // TomSelect uses .on
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

  saveButton.addEventListener('click', function () {
    saveButton.setAttribute('disabled', true);
    editors.primary.save().then((savedData) => {
      // Update or create
      const endpoint = savedPost._id
        ? `/dynamic-api/micro/entry/${savedPost._id}`
        : '/dynamic-api/micro/entry';
      const transformedPostMeta = {
        ...postMeta,
        socialLinks: socialLinksToArray(postMeta.socialLinks),
      };
      axios
        .post(endpoint, {
          ...transformedPostMeta,
          post: savedData,
        })
        .then((resp) => {
          return Promise.all([
            Promise.resolve(resp),
            axios.get('/dynamic-api/tags'),
          ]);
        })
        .then(([resp, tags]) => {
          tagSelect.clearOptions();
          tagSelect.addOptions(tags.data);
          updateModelFromDb(resp.data);
          setInputValues();
          saveButton.removeAttribute('disabled');
          window.history.pushState({}, null, `/micro/editor/${resp.data.slug}`);
        });
    });
  });

  // Ready
  document.getElementById('loading-overlay').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', onFirstLoad);
