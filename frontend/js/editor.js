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
  slug: DateTime.now().toFormat('yyyyMMddHHmm'),
  tags: [],
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
      image: {
        class: ImageTool,
        config: {
          endpoints: {
            byFile: '/dynamic-api/micro/image/byFile',
            byUrl: '/dynamic-api/micro/image/byUrl',
          },
          types: 'image/*, video/*',
          actions: [
            {
              name: 'white',
              icon: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">  <path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" /></svg>',
              title: 'Has white background',
              toggle: true,
            },
          ],
        },
      },
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
          window.history.pushState({}, null, `/micro/editor/${resp.data.slug}`);
        });
    });
  });

  // Ready
  document.getElementById('loading-overlay').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', onFirstLoad);
