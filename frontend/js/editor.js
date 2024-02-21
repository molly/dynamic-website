import axios from 'axios';
import { DateTime } from 'luxon';
import '../../css/feed-editor.css';
import { getSlugFromTitle } from './helpers/editorHelpers.js';

import EditorJS from '@editorjs/editorjs';
import Header from '@editorjs/header';
import InlineCode from '@editorjs/inline-code';
import List from '@editorjs/list';
import Quote from '@editorjs/quote';

import ImageTool from '@editorjs/image';
import LinkTool from '@editorjs/link';
import RawTool from '@editorjs/raw';
import debounce from 'lodash.debounce';
import TomSelect from 'tom-select';

const postMeta = {
  title: '',
  slug: new Date().toISOString().slice(0, 16).replace(/\D/g, ''),
  tags: [],
  relatedFeedPostIds: [],
  id: null,
};
let savedPost = {};
let tagSelect;

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

function updateModelFromDb(data) {
  savedPost = data;
  postMeta.title = data.title;
  postMeta.slug = data.slug;
  postMeta.tags = data.tags;
  postMeta.relatedFeedPostIds = data.relatedFeedPostIds;
  postMeta.id = data.id;
}

function setInputValues() {
  const titleEl = document.getElementById('title');
  const slugEl = document.getElementById('slug');
  const lastEdited = document.getElementById('last-edited');

  titleEl.value = postMeta.title;
  slugEl.value = postMeta.slug;
  tagSelect.setValue(postMeta.tags);
  if (savedPost.updatedAt) {
    slugEl.setAttribute('disabled', true);
    lastEdited.textContent = `Last edited: ${DateTime.fromISO(savedPost.updatedAt).toLocaleString(DateTime.DATETIME_FULL)}`;
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
  const editor = new EditorJS({
    holder: 'editorjs',
    autofocus: true,
    tools: {
      header: Header,
      image: ImageTool,
      inlineCode: InlineCode,
      linkTool: LinkTool,
      list: {
        class: List,
        inlineToolbar: true,
        config: { defaultStyle: 'unordered' },
      },
      quote: Quote,
      raw: RawTool,
    },
    data: savedPost.post || {},
  });

  // Load TomSelect for tags editor
  const { data: tagOptions } = await axios.get('/dynamic-api/micro/tags');
  tagSelect = new TomSelect('#tags', {
    create: true,
    items: postMeta.tags,
    valueField: '_id',
    options: tagOptions,
  });

  // Selectors
  const titleEl = document.getElementById('title');
  const slugEl = document.getElementById('slug');
  // const relatedEl = document.getElementById('related');
  const saveButton = document.getElementById('save-button');

  // Set initial values
  setInputValues();

  // Attach handlers
  titleEl.addEventListener('keydown', debouncedOnTitleChange);
  slugEl.addEventListener('keydown', debouncedOnSlugChange);

  // TomSelect uses .on
  tagSelect.on('change', function (value) {
    if (value) {
      postMeta.tags = value.split(',');
    } else {
      postMeta.tags = [];
    }
  });

  saveButton.addEventListener('click', function () {
    saveButton.setAttribute('disabled', true);
    editor.save().then((savedData) => {
      // Update or create
      const endpoint = savedPost._id
        ? `/dynamic-api/micro/entry/${savedPost._id}`
        : '/dynamic-api/micro/entry';
      axios
        .post(endpoint, {
          ...postMeta,
          post: savedData,
        })
        .then((resp) => {
          return Promise.all([
            Promise.resolve(resp),
            axios.get('/dynamic-api/micro/tags'),
          ]);
        })
        .then(([resp, tags]) => {
          tagSelect.clearOptions();
          tagSelect.addOptions(tags.data);
          updateModelFromDb(resp.data);
          setInputValues();
          saveButton.removeAttribute('disabled');
        });
    });
  });

  // Ready
  document.getElementById('loading-overlay').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', onFirstLoad);
