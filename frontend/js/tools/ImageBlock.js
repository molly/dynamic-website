import ImageTool from '@editorjs/image';
import axios from 'axios';
import {
  editableText,
  plainTextField,
  plainTextHtml,
} from '../helpers/plainPaste.js';
import { chooseLinkedFile } from '../helpers/upload.js';

// The image block: @editorjs/image, with
//  - alt text kept as plain text, with newlines for line breaks. The tool itself saves the alt
//    field's HTML, which the site then shows escaped ("&amp;", "&nbsp;"); the gallery's alt text
//    is plain text the same way.
//  - pastes and Enter in the alt text and caption staying in the field (plainTextField), rather
//    than Editor.js turning them into new blocks
//  - "or use a link", for an image or video that's already online
//  - "with border" switched on by itself for an image with white edges (a screenshot of a
//    document or web page), which would otherwise blend into the page. The server works that out
//    (backend/helpers/imageEdges.js); the border can be switched off as usual.

export default class ImageBlock extends ImageTool {
  constructor(options) {
    super(options);
    this.ui.fillAlt(plainTextHtml(this.data.alt));
  }

  render() {
    const wrapper = super.render();
    if (!this.ui.readOnly && !this.linkButton) {
      plainTextField(this.ui.nodes.alt);
      plainTextField(this.ui.nodes.caption);
      this.linkButton = Object.assign(document.createElement('button'), {
        type: 'button',
        className: 'link-button image-block-link',
        textContent: 'or use a link',
      });
      this.linkButton.addEventListener('click', () => this.useLink());
      wrapper.appendChild(this.linkButton);
    }
    return wrapper;
  }

  async useLink() {
    try {
      const file = await chooseLinkedFile({
        accept: ['image', 'video'],
        label: 'image or video',
      });
      if (file) {
        this.onUpload({ success: 1, file });
      }
    } catch (err) {
      this.api.notifier.show({
        message: `Couldn’t use that link: ${err.message}`,
        style: 'error',
      });
    }
  }

  onUpload(response) {
    super.onUpload(response);
    if (response?.success && response.file?.url) {
      this.borderLightImage(response.file).catch((err) =>
        console.error('Couldn’t check the image’s edges', err),
      );
    }
  }

  async borderLightImage(file) {
    if (file.contentType && !file.contentType.startsWith('image/')) {
      return; // Videos aren't checked
    }
    let { lightEdges } = file;
    if (lightEdges === undefined) {
      // Added by its link without being uploaded or copied, so not checked yet
      ({
        data: { lightEdges },
      } = await axios.get('/dynamic-api/micro/image/lightEdges', {
        params: { url: file.url },
      }));
    }
    if (lightEdges && !this.data.withBorder) {
      this.setTune('withBorder', true);
    }
  }

  save() {
    const data = super.save();
    data.alt = editableText(this.ui.nodes.alt);
    return data;
  }
}
