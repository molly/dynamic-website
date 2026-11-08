import {
  DOCUMENT_SIDES,
  withDocumentSides,
} from '../../../api/helpers/documentParties.js';
import { createAboutPicker } from '../helpers/pickers.js';
import { escapeHtml } from '../helpers/escapeHtml.js';
import { insertPlainText } from '../helpers/plainPaste.js';
import {
  chooseLinkedFile,
  pdfThumbnail,
  pdfThumbnailFromFile,
  uploadFile,
} from '../helpers/upload.js';

// "Document" block: an excerpt from a court filing, a letter or another document, with links to
// the PDF (at a page), the docket and your coverage. Select words in the excerpt and use Highlight
// to mark them as "highlight mine".
// Data: { docType: 'filing' | 'letter' | 'other', title, date, paragraph, excerptHtml, pdfUrl,
//   pdfPage, docketUrl, thumbnail, coverageUrl, entity: { _id, name, type }, senders, recipients }
// entity is the case or bill the document belongs to. senders and recipients (letters and other
// documents) are each { prefix, people: [{ name, role, entity }], more }: see
// api/helpers/documentParties.js. Names stay as written, shown in bold and linked to the entity
// if they're one; roles are descriptors as the document has them ("Secretary of Commerce").
// display: 'highlights' (default) shows only the highlighted passages; 'full' shows the whole
// excerpt on the post's own page. The feed always shows highlights only.

const FIELDS = [
  'title',
  'date',
  'paragraph',
  'pdfUrl',
  'pdfPage',
  'docketUrl',
  'coverageUrl',
];
const DISPLAYS = [
  ['highlights', 'only the highlights'],
  ['full', 'the full passage'],
];
const KINDS = [
  ['filing', 'Court filing'],
  ['letter', 'Letter'],
  ['other', 'Other document'],
];
// The sender and recipient sections of the card
const SIDE_LABELS = {
  senders: { heading: 'From', one: 'sender' },
  recipients: { heading: 'To', one: 'recipient' },
};
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
      insertPlainText(evt.clipboardData.getData('text/plain'));
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
      ...keep([
        ...FIELDS,
        'docType',
        'display',
        'thumbnail',
        'entity',
        ...DOCUMENT_SIDES,
      ]),
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
    // Documents from before a side could list several people are read into the current shape.
    this.data = withDocumentSides({
      docType: 'filing',
      excerptHtml: '',
      ...data,
    });
  }

  // One side's fields: a title shared by everyone listed, a row per person (entity, name as
  // written, descriptor), and how many others aren't named. There's always at least one row.
  renderSide(side) {
    const { heading, one } = SIDE_LABELS[side];
    const { prefix, people, more } = this.data[side];
    const disabled = this.readOnly ? ' disabled' : '';
    const field = (attr, name, value, placeholder, type = 'text') =>
      `<input type="${type}" ${attr}="${name}" placeholder="${placeholder}" aria-label="${placeholder}" value="${escapeHtml(value ?? '')}"${type === 'number' ? ' min="0"' : ''}${disabled}>`;
    const rows = (people.length ? people : [{}]).map(
      (person, i) => `<div class="document-person" data-index="${i}">
        <select class="document-person-entity" aria-label="${heading}: entity" placeholder="Entity (optional)"></select>
        ${field('data-person-field', 'name', person.name, 'Name as written, e.g. Warren')}
        ${field('data-person-field', 'role', person.role, 'Title, e.g. Ranking Member')}
        ${this.readOnly ? '' : `<button type="button" class="link-button remove-person" aria-label="Remove this ${one}">remove</button>`}
      </div>`,
    );
    return `<fieldset class="document-side" data-side="${side}">
      <legend>${heading}</legend>
      ${field('data-side-field', 'prefix', prefix, 'Shared title, e.g. Sens.')}
      <div class="document-people">${rows.join('')}</div>
      <div class="document-side-more">
        ${this.readOnly ? '' : `<button type="button" class="link-button add-person">+ add ${one}</button> ·`}
        and ${field('data-side-field', 'more', more || '', '0', 'number')} others
      </div>
    </fieldset>`;
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
        <span class="filing-only">¶ ${input('paragraph', 'Paragraph')}</span>
      </div>
      <div class="document-tool-row not-filing document-sides">
        ${DOCUMENT_SIDES.map((side) => this.renderSide(side)).join('')}
      </div>
      <div class="document-excerpt-input" contenteditable="${!this.readOnly}" data-placeholder="Excerpt. Select words and use Highlight for “highlight mine”.">${d.excerptHtml || ''}</div>
      <div class="document-tool-row document-display">
        <label>On the post page, show
          <select data-field="display"${this.readOnly ? ' disabled' : ''}>
            ${DISPLAYS.map(([value, label]) => `<option value="${value}"${(d.display || 'highlights') === value ? ' selected' : ''}>${label}</option>`).join('')}
          </select></label>
        <span class="side-hint">The feed always shows only the highlights.</span>
      </div>
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
        ${this.readOnly ? '' : `<button type="button" class="link-button thumb-pdf">${d.thumbnail ? 'remake' : 'make'} first-page image from the PDF</button> or <label class="link-button">from a downloaded PDF<input type="file" accept="application/pdf,.pdf" data-pdf hidden></label> · <label class="link-button">upload one<input type="file" accept="image/*" hidden></label> or <button type="button" class="link-button thumb-url">use a link</button>${d.thumbnail ? ' · <button type="button" class="link-button remove-thumb">remove</button>' : ''}`}
      </div>`;
    isolateKeys(this.wrapper);
    this.wrapper.addEventListener('change', (evt) => this.onChange(evt));
    this.wrapper.addEventListener('click', (evt) => {
      if (evt.target.closest('.remove-thumb')) {
        this.data.thumbnail = null;
        this.redraw();
      } else if (evt.target.closest('.thumb-url')) {
        this.thumbnailFromUrl();
      } else if (evt.target.closest('.thumb-pdf')) {
        this.thumbnailFromPdf(evt.target.closest('.thumb-pdf'));
      } else if (evt.target.closest('.add-person')) {
        const side = evt.target.closest('[data-side]').dataset.side;
        this.data = this.readForm();
        this.data[side].people.push({ name: '', role: '', entity: null });
        this.redraw({
          read: false,
          focus: `[data-side="${side}"] .document-person:last-child [data-person-field="name"]`,
        });
      } else if (evt.target.closest('.remove-person')) {
        const side = evt.target.closest('[data-side]').dataset.side;
        const index = Number(evt.target.closest('[data-index]').dataset.index);
        this.data = this.readForm();
        this.data[side].people.splice(index, 1);
        this.redraw({ read: false });
      }
    });
    return this.wrapper;
  }

  rendered() {
    // The pickers need to be in the page to open their dropdowns.
    if (this.pickers) {
      return;
    }
    // Each picker sets one entity; a sender's or recipient's also fills in the name as written,
    // if it's still empty.
    const picker = (select, initial, set, nameInput) => {
      const p = createAboutPicker(select, {
        initial: initial ? [initial] : [],
        maxItems: 1,
        onChange: (ids) => {
          const id = ids[0];
          const option = id ? p.options[id] : null;
          set(
            option ? { _id: id, name: option.name, type: option.type } : null,
          );
          if (option && nameInput && !nameInput.value.trim()) {
            nameInput.value = option.name;
          }
        },
      });
      if (this.readOnly) {
        p.disable();
      }
      return p;
    };
    this.pickers = [
      picker(
        this.wrapper.querySelector('.document-entity'),
        this.data.entity,
        (entity) => {
          this.data.entity = entity;
        },
      ),
    ];
    for (const row of this.wrapper.querySelectorAll('.document-person')) {
      const { side } = row.closest('[data-side]').dataset;
      const index = Number(row.dataset.index);
      this.pickers.push(
        picker(
          row.querySelector('.document-person-entity'),
          this.data[side].people[index]?.entity,
          (entity) => {
            const { people } = this.data[side];
            people[index] = { ...people[index], entity };
          },
          row.querySelector('[data-person-field="name"]'),
        ),
      );
    }
  }

  async onChange(evt) {
    const field = evt.target.dataset.field;
    if (field === 'docType') {
      this.data.docType = evt.target.value;
      this.wrapper.className = `document-tool kind-${this.data.docType}`;
    } else if (field === 'display') {
      this.data.display = evt.target.value;
    } else if (evt.target.type === 'file' && evt.target.files[0]) {
      const file = evt.target.files[0];
      const fromPdf = 'pdf' in evt.target.dataset;
      try {
        this.data.thumbnail = fromPdf
          ? (await pdfThumbnailFromFile(file)).url
          : (await uploadFile(file)).url;
        this.redraw();
      } catch (err) {
        window.alert(
          `${fromPdf ? 'Couldn’t make an image from that PDF' : 'Upload failed'}: ${err.message}`,
        );
      }
    }
  }

  async thumbnailFromUrl() {
    try {
      const file = await chooseLinkedFile({ label: 'first-page image' });
      if (file) {
        this.data.thumbnail = file.url;
        this.redraw();
      }
    } catch (err) {
      window.alert(`Couldn't use that image: ${err.message}`);
    }
  }

  // Optional: draws page 1 of the PDF on the server and stores just that image. Without a
  // thumbnail the card is text only.
  async thumbnailFromPdf(button) {
    const url = this.wrapper
      .querySelector('[data-field="pdfUrl"]')
      .value.trim();
    if (!url) {
      window.alert('Add the PDF URL first.');
      return;
    }
    const label = button.textContent;
    button.disabled = true;
    button.textContent = 'making image…';
    try {
      this.data.thumbnail = (await pdfThumbnail(url)).url;
      this.redraw();
    } catch (err) {
      button.disabled = false;
      button.textContent = label;
      window.alert(`Couldn't make an image from that PDF: ${err.message}`);
    }
  }

  // Draw the card again. read: take what's typed first (false when this.data was just updated
  // from the form, as when adding or removing a person). focus: a field to put the cursor in.
  redraw({ read = true, focus } = {}) {
    if (read) {
      this.data = this.readForm();
    }
    this.pickers?.forEach((p) => p.destroy());
    this.pickers = null;
    const old = this.wrapper;
    old.replaceWith(this.render());
    this.rendered();
    if (focus) {
      this.wrapper.querySelector(focus)?.focus();
    }
  }

  // The card as filled in, keeping empty person rows (for redrawing while editing)
  readForm() {
    const data = { ...this.data };
    for (const el of this.wrapper.querySelectorAll('input[data-field]')) {
      data[el.dataset.field] = el.value.trim();
    }
    for (const fieldset of this.wrapper.querySelectorAll('[data-side]')) {
      const { side } = fieldset.dataset;
      const value = (name) =>
        fieldset.querySelector(`[data-side-field="${name}"]`).value.trim();
      data[side] = {
        prefix: value('prefix'),
        more: Math.max(0, Math.floor(Number(value('more'))) || 0),
        people: [...fieldset.querySelectorAll('.document-person')].map(
          (row) => ({
            name: row.querySelector('[data-person-field="name"]').value.trim(),
            role: row.querySelector('[data-person-field="role"]').value.trim(),
            entity:
              this.data[side].people[Number(row.dataset.index)]?.entity || null,
          }),
        ),
      };
    }
    data.excerptHtml = this.wrapper
      .querySelector('.document-excerpt-input')
      .innerHTML.replace(/(<br>)+$/, '');
    return data;
  }

  save() {
    const data = this.readForm();
    for (const side of DOCUMENT_SIDES) {
      data[side].people = data[side].people.filter((p) => p.name || p.entity);
    }
    return data;
  }

  validate(data) {
    return Boolean(data.title || data.excerptHtml || data.pdfUrl);
  }
}
