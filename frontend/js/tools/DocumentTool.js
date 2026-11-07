import { createAboutPicker } from '../helpers/pickers.js';
import { escapeHtml } from '../helpers/escapeHtml.js';
import { uploadFile } from '../helpers/upload.js';

// "Document" block: an excerpt from a court filing, a letter or another document, with links to
// the PDF (at a page), the docket and your coverage. Select words in the excerpt and use Highlight
// to mark them as "highlight mine".
// Data: { docType: 'filing' | 'letter' | 'other', title, date, from, to, paragraph, excerptHtml,
//   pdfUrl, pdfPage, docketUrl, thumbnail, coverageUrl, entity: { _id, name, type } }

const FIELDS = [
  'title',
  'date',
  'from',
  'to',
  'paragraph',
  'pdfUrl',
  'pdfPage',
  'docketUrl',
  'coverageUrl',
];
const KINDS = [
  ['filing', 'Court filing'],
  ['letter', 'Letter'],
  ['other', 'Other document'],
];
const keep = (keys) => Object.fromEntries(keys.map((key) => [key, true]));

// Typing in the card's own fields shouldn't trigger the editor's keyboard handling, and Enter in
// the excerpt is a line break, not a new block.
export function isolateKeys(wrapper) {
  wrapper.addEventListener('keydown', (evt) => {
    evt.stopPropagation();
    if (evt.key === 'Enter' && evt.target.isContentEditable) {
      evt.preventDefault();
      document.execCommand('insertLineBreak');
    }
  });
  // Pasted text arrives as plain text, not as new blocks or someone else's markup.
  wrapper.addEventListener('paste', (evt) => {
    if (evt.target.isContentEditable) {
      evt.preventDefault();
      evt.stopPropagation();
      document.execCommand(
        'insertText',
        false,
        evt.clipboardData.getData('text/plain'),
      );
    } else {
      evt.stopPropagation();
    }
  });
}

export default class DocumentTool {
  static get toolbox() {
    return {
      title: 'Document',
      icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
    };
  }

  static get isReadOnlySupported() {
    return true;
  }

  // The excerpt keeps highlights, links and emphasis; the other fields are plain text and are
  // left as typed (sanitizing them would turn & into &amp;).
  static get sanitize() {
    return {
      ...keep([...FIELDS, 'docType', 'thumbnail', 'entity']),
      excerptHtml: {
        mark: true,
        a: { href: true },
        b: true,
        i: true,
        br: true,
      },
    };
  }

  constructor({ data, readOnly }) {
    this.readOnly = readOnly;
    this.data = { docType: 'filing', excerptHtml: '', ...data };
  }

  render() {
    const d = this.data;
    const input = (name, placeholder, type = 'text') =>
      `<input type="${type}" data-field="${name}" placeholder="${placeholder}" aria-label="${placeholder}" value="${escapeHtml(d[name] ?? '')}"${this.readOnly ? ' disabled' : ''}>`;
    this.wrapper = document.createElement('div');
    this.wrapper.className = `document-tool kind-${d.docType}`;
    this.wrapper.innerHTML = `
      <div class="document-tool-row">
        <select data-field="docType" aria-label="Kind of document"${this.readOnly ? ' disabled' : ''}>
          ${KINDS.map(([value, label]) => `<option value="${value}"${d.docType === value ? ' selected' : ''}>${label}</option>`).join('')}
        </select>
        ${input('title', 'Title, e.g. Complaint · O’Leary v. Armstrong')}
      </div>
      <div class="document-tool-row">
        ${input('date', 'Date', 'date')}
        <span class="not-filing">${input('from', 'From, e.g. Senate Banking')} → ${input('to', 'To')}</span>
        <span class="filing-only">¶ ${input('paragraph', 'Paragraph')}</span>
      </div>
      <div class="document-excerpt-input" contenteditable="${!this.readOnly}" data-placeholder="Excerpt. Select words and use Highlight for “highlight mine”.">${d.excerptHtml || ''}</div>
      <div class="document-tool-row links">
        ${input('pdfUrl', 'PDF URL', 'url')} ${input('pdfPage', 'page', 'number')}
        ${input('docketUrl', 'Docket URL', 'url')}
      </div>
      <div class="document-tool-row links">
        ${input('coverageUrl', 'Your coverage of it (URL)', 'url')}
        <select class="document-entity" aria-label="Case or bill" placeholder="Case or bill (optional)"></select>
      </div>
      <div class="document-tool-row thumbnail-row">
        <span class="document-thumb">${d.thumbnail ? `<img src="${escapeHtml(d.thumbnail)}" alt="">` : ''}</span>
        ${this.readOnly ? '' : `<label class="link-button">${d.thumbnail ? 'change first-page image' : 'add first-page image'}<input type="file" accept="image/*" hidden></label>${d.thumbnail ? ' <button type="button" class="link-button remove-thumb">remove</button>' : ''}`}
      </div>`;
    isolateKeys(this.wrapper);
    this.wrapper.addEventListener('change', (evt) => this.onChange(evt));
    this.wrapper.addEventListener('click', (evt) => {
      if (evt.target.closest('.remove-thumb')) {
        this.data.thumbnail = null;
        this.redraw();
      }
    });
    return this.wrapper;
  }

  rendered() {
    // The picker needs to be in the page to open its dropdown.
    if (!this.entityPicker) {
      this.entityPicker = createAboutPicker(
        this.wrapper.querySelector('.document-entity'),
        {
          initial: this.data.entity ? [this.data.entity] : [],
          maxItems: 1,
          onChange: (ids) => {
            const id = ids[0];
            const option = id ? this.entityPicker.options[id] : null;
            this.data.entity = option
              ? { _id: id, name: option.name, type: option.type }
              : null;
          },
        },
      );
      if (this.readOnly) {
        this.entityPicker.disable();
      }
    }
  }

  async onChange(evt) {
    const field = evt.target.dataset.field;
    if (field === 'docType') {
      this.data.docType = evt.target.value;
      this.wrapper.className = `document-tool kind-${this.data.docType}`;
    } else if (evt.target.type === 'file' && evt.target.files[0]) {
      try {
        this.data.thumbnail = (await uploadFile(evt.target.files[0])).url;
        this.redraw();
      } catch (err) {
        window.alert(`Upload failed: ${err.message}`);
      }
    }
  }

  redraw() {
    this.data = this.save();
    this.entityPicker?.destroy();
    this.entityPicker = null;
    const old = this.wrapper;
    old.replaceWith(this.render());
    this.rendered();
  }

  save() {
    const data = { ...this.data };
    for (const el of this.wrapper.querySelectorAll('input[data-field]')) {
      data[el.dataset.field] = el.value.trim();
    }
    data.excerptHtml = this.wrapper
      .querySelector('.document-excerpt-input')
      .innerHTML.replace(/(<br>)+$/, '');
    return data;
  }

  validate(data) {
    return Boolean(data.title || data.excerptHtml || data.pdfUrl);
  }
}
