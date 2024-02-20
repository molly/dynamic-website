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

async function onFirstLoad() {
  // Load data
  const slug = window.location.pathname.split('/').slice(3);
  if (slug.length) {
    try {
      const resp = await axios.get(`/dynamic-api/micro/entry/${slug}`);
      if (resp) {
        const data = resp.data;
        savedPost = data;
        postMeta.title = data.title;
        postMeta.slug = data.slug;
        postMeta.tags = data.tags;
        postMeta.relatedFeedPostIds = data.relatedFeedPostIds;
        postMeta.id = data.id;
      }
    } catch (err) {
      if (err.response.status === 404) {
        document.querySelector('#error-overlay .error-message').textContent =
          `No post with the slug "${slug}" was found.`;
        document.getElementById('loading-overlay').classList.add('hidden');
        document.getElementById('error-overlay').classList.remove('hidden');
        return;
      }
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
  new TomSelect('#tags', {
    create: true,
  });

  // Selectors
  const titleEl = document.getElementById('title');
  const slugEl = document.getElementById('slug');
  // const tagsEl = document.getElementById('tags');
  // const relatedEl = document.getElementById('related');
  const lastEdited = document.getElementById('last-edited');
  const saveButton = document.getElementById('save-button');

  // Set initial values
  titleEl.value = postMeta.title;
  slugEl.value = postMeta.slug;
  if (savedPost.updatedAt) {
    slugEl.setAttribute('disabled', true);
    lastEdited.textContent = `Last edited: ${DateTime.fromISO(savedPost.updatedAt).toLocaleString(DateTime.DATETIME_FULL)}`;
  }

  // Attach handlers
  titleEl.addEventListener('keydown', debouncedOnTitleChange);
  slugEl.addEventListener('keydown', debouncedOnSlugChange);
  saveButton.addEventListener('click', function () {
    editor.save().then((savedData) => {
      if (savedPost._id) {
        // Update
        axios.post(`/dynamic-api/micro/entry/${savedPost._id}`, {
          ...postMeta,
          post: savedData,
        });
      } else {
        // Create
        axios.post('/dynamic-api/micro/entry', {
          ...postMeta,
          post: savedData,
        });
      }
    });
  });

  // Ready
  document.getElementById('loading-overlay').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', onFirstLoad);
