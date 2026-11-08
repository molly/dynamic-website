import axios from 'axios';
import Sortable from 'sortablejs';
import { chooseLinkedFile } from '../../helpers/upload.js';
import {
  CAPTION_SANITIZE,
  editableText,
  inlineTextField,
  plainTextField,
  plainTextHtml,
} from '../../helpers/plainPaste.js';
import buttonIcon from './svg/button-icon.svg';
import toolboxIcon from './svg/toolbox.svg';
import trashIcon from './svg/trash.svg';

// Gallery block, forked from editorjs-gallery 1.0.12 (see LICENSE) so each image can carry
// its own alt text, caption and white-background flag.
// Data: { caption, files: [{ url, contentType?, alt, caption, white }] }. Captions keep links, bold
// and italic; alt text is plain.

const WHITE_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" /></svg>';

const isVideo = (file) =>
  file.contentType?.startsWith('video/') || /\.mp4$/i.test(file.url);

function make(tag, classNames = [], props = {}) {
  const el = document.createElement(tag);
  el.classList.add(...[].concat(classNames).filter(Boolean));
  Object.assign(el, props);
  return el;
}

export default class ImageGallery {
  static get isReadOnlySupported() {
    return true;
  }

  static get toolbox() {
    return { icon: toolboxIcon, title: 'Gallery' };
  }

  // With inline tools on, Editor.js sanitizes every text field it isn't told about, which would
  // turn the & in a file's URL or the alt text into &amp;. So only the captions are cleaned.
  static get sanitize() {
    return {
      caption: CAPTION_SANITIZE,
      files: {
        caption: CAPTION_SANITIZE,
        url: true,
        contentType: true,
        alt: true,
      },
      style: true,
    };
  }

  constructor({ data, config, api, readOnly }) {
    this.api = api;
    this.readOnly = readOnly;
    this.config = {
      endpoints: config.endpoints || {},
      field: config.field || 'image',
      types: config.types || 'image/*',
      captionPlaceholder: config.captionPlaceholder || 'Gallery caption',
      maxElementCount: config.maxElementCount,
    };
    // Keep fields this tool doesn't edit (such as the old slider/fit style) as they were.
    this.data = { ...data, caption: data.caption || '' };
    this.items = []; // { file, el } in display order
    this.nodes = {};
  }

  render() {
    const { styles } = this.api;
    this.nodes.wrapper = make('div', [styles.block, 'image-gallery']);
    this.nodes.items = make('div', 'image-gallery__items');
    this.nodes.controls = make('div', 'image-gallery__controls');
    this.nodes.preloaders = make('div', 'image-gallery__preloaders');
    this.nodes.fileButton = make('div', styles.button, {
      innerHTML: `${buttonIcon} Select images`,
    });
    this.nodes.fileButton.addEventListener('click', () => this.selectFiles());
    this.nodes.linkButton = make('button', 'link-button', {
      type: 'button',
      textContent: 'or use a link',
    });
    this.nodes.linkButton.addEventListener('click', () => this.addFromLink());
    this.nodes.caption = this.makeEditable(
      [styles.input, 'image-gallery__caption'],
      this.data.caption,
      this.config.captionPlaceholder,
      inlineTextField,
    );

    if (!this.readOnly) {
      this.nodes.controls.append(
        this.nodes.preloaders,
        this.nodes.fileButton,
        this.nodes.linkButton,
      );
    }
    this.nodes.wrapper.append(
      this.nodes.items,
      this.nodes.controls,
      this.nodes.caption,
    );
    (this.data.files || []).forEach((file) => this.appendImage(file));
    return this.nodes.wrapper;
  }

  rendered() {
    if (this.readOnly || this.sortable) {
      return;
    }
    this.sortable = new Sortable(this.nodes.items, {
      handle: '.image-gallery__thumb',
      // Native drag and drop carries the item's text (its alt and caption) as drag data, and the
      // browser pastes that into whatever editable field it's dropped on. Sortable's own
      // pointer-based dragging has no drag data.
      forceFallback: true,
      filter: '.image-gallery__thumb-button',
      preventOnFilter: false,
      onEnd: ({ oldIndex, newIndex }) => {
        if (oldIndex !== newIndex) {
          this.items.splice(newIndex, 0, this.items.splice(oldIndex, 1)[0]);
        }
      },
    });
  }

  // Pastes and Enter stay in the field, as line breaks, rather than becoming new blocks. A
  // caption keeps links, bold and italic (inlineTextField); alt text is plain (plainTextField).
  makeEditable(classNames, html, placeholder, field) {
    const el = make('div', classNames, {
      contentEditable: !this.readOnly,
      innerHTML: html || '',
    });
    el.dataset.placeholder = placeholder;
    if (!this.readOnly) {
      field(el);
    }
    return el;
  }

  appendImage(file) {
    if (!file?.url || this.isFull()) {
      return;
    }
    const el = make('div', 'image-gallery__image');
    const thumb = make('div', 'image-gallery__thumb');
    const media = isVideo(file)
      ? make('video', 'image-gallery__picture', {
          src: file.url,
          muted: true,
          playsInline: true,
        })
      : make('img', 'image-gallery__picture', { src: file.url });
    thumb.append(media);

    const item = { file: { ...file }, el };
    el.classList.toggle('image-gallery__image--white', Boolean(file.white));

    if (!this.readOnly) {
      const white = make('button', 'image-gallery__thumb-button', {
        type: 'button',
        innerHTML: WHITE_ICON,
        title: 'Has white background',
      });
      white.classList.toggle('active', Boolean(file.white));
      white.addEventListener('click', () => {
        item.file.white = !item.file.white;
        white.classList.toggle('active', item.file.white);
        el.classList.toggle('image-gallery__image--white', item.file.white);
      });
      const trash = make('button', 'image-gallery__thumb-button', {
        type: 'button',
        innerHTML: trashIcon,
        title: 'Delete',
      });
      trash.addEventListener('click', () => this.removeItem(item));
      thumb.append(white, trash);
    }

    // Alt text is plain text, with newlines for its line breaks
    item.alt = this.makeEditable(
      [this.api.styles.input, 'image-gallery__alt'],
      plainTextHtml(file.alt),
      'Alt text',
      plainTextField,
    );
    item.caption = this.makeEditable(
      [this.api.styles.input, 'image-gallery__item-caption'],
      file.caption,
      'Image caption',
      inlineTextField,
    );
    el.append(thumb, item.alt, item.caption);
    this.items.push(item);
    this.nodes.items.append(el);
    this.updateFileButton();
  }

  removeItem(item) {
    const i = this.items.indexOf(item);
    if (i >= 0) {
      this.items.splice(i, 1);
      item.el.remove();
      this.updateFileButton();
    }
  }

  // Add an image or video that's already online, e.g. one uploaded for another post
  async addFromLink() {
    try {
      const file = await chooseLinkedFile({
        accept: ['image', 'video'],
        label: 'image or video',
      });
      if (file) {
        this.appendImage(file);
      }
    } catch (err) {
      this.api.notifier.show({
        message: `Couldn’t use that link: ${err.message}`,
        style: 'error',
      });
    }
  }

  isFull() {
    const max = this.config.maxElementCount;
    return Boolean(max) && this.items.length >= max;
  }

  updateFileButton() {
    if (this.nodes.fileButton) {
      this.nodes.fileButton.hidden = this.isFull();
      this.nodes.linkButton.hidden = this.isFull();
    }
  }

  selectFiles() {
    const input = make('input', [], {
      type: 'file',
      accept: this.config.types,
      multiple: true,
    });
    input.addEventListener('change', () => {
      const max = this.config.maxElementCount;
      const files = [...input.files];
      files
        .slice(0, max ? max - this.items.length : files.length)
        .forEach((file) => this.upload(file));
    });
    input.click();
  }

  async upload(file) {
    const preloader = make('div', 'image-gallery__preloader');
    const preview = file.type.startsWith('image/')
      ? URL.createObjectURL(file)
      : null;
    if (preview) {
      preloader.style.backgroundImage = `url(${preview})`;
    }
    this.nodes.preloaders.append(preloader);
    try {
      const form = new FormData();
      form.append(this.config.field, file);
      const { data } = await axios.post(this.config.endpoints.byFile, form);
      if (!data.success || !data.file?.url) {
        throw new Error(`unexpected response: ${JSON.stringify(data)}`);
      }
      this.appendImage(data.file);
    } catch (err) {
      console.error('Gallery upload failed:', err);
      this.api.notifier.show({
        message: `Couldn’t upload ${file.name}: ${err.response?.data?.error || err.message}`,
        style: 'error',
      });
    } finally {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
      preloader.remove();
    }
  }

  save() {
    return {
      ...this.data,
      caption: this.nodes.caption.innerHTML,
      files: this.items.map(({ file, alt, caption }) => ({
        ...file,
        alt: editableText(alt),
        caption: caption.innerHTML,
      })),
    };
  }

  validate(data) {
    return data.files.length > 0;
  }
}
