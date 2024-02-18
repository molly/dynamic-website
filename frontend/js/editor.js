import '../../css/feed-editor.css';

import EditorJS from '@editorjs/editorjs';
import Header from '@editorjs/header';
import InlineCode from '@editorjs/inline-code';
import List from '@editorjs/list';
import Quote from '@editorjs/quote';

import ImageTool from '@editorjs/image';
import LinkTool from '@editorjs/link';
import RawTool from '@editorjs/raw';

import TomSelect from 'tom-select';

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

const saveButton = document.getElementById('saveButton');
saveButton.addEventListener('click', function () {
  editor.save().then((savedData) => {
    console.log(savedData);
  });
});
