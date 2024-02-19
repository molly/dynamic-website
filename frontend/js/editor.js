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
  slug: '',
  tags: [],
  relatedPosts: [],
};

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
});

new TomSelect('#tags', {
  create: true,
});

document
  .getElementById('title')
  .addEventListener('keydown', debouncedOnTitleChange);

document
  .getElementById('slug')
  .addEventListener('keydown', debouncedOnSlugChange);

const saveButton = document.getElementById('saveButton');
saveButton.addEventListener('click', function () {
  editor.save().then((savedData) => {
    console.log(savedData);
  });
});
