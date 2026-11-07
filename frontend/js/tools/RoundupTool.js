import { escapeHtml } from '../helpers/escapeHtml.js';
import { createShortformSearch, snapshotOf } from './shortformSearch.js';

// "Link roundup" block: several articles in one post, each with your line about it.
// Data: { items: [{ ref, line, snapshot: { title, href, work, author } }] }

export default class RoundupTool {
  static get toolbox() {
    return {
      title: 'Link roundup',
      icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
    };
  }

  static get isReadOnlySupported() {
    return true;
  }

  constructor({ data, readOnly }) {
    this.readOnly = readOnly;
    this.data = { items: [], ...data };
    this.adding = this.data.items.length === 0;
  }

  render() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'roundup-tool';
    this.wrapper.addEventListener('keydown', (evt) => evt.stopPropagation());
    this.wrapper.addEventListener('input', (evt) => {
      const index = evt.target.dataset?.line;
      if (index !== undefined) {
        this.data.items[index].line = evt.target.value;
      }
    });
    this.wrapper.addEventListener('click', (evt) => {
      const remove = evt.target.closest('[data-remove]');
      if (remove) {
        this.data.items.splice(Number(remove.dataset.remove), 1);
        this.draw();
      } else if (evt.target.closest('.roundup-add')) {
        this.adding = true;
        this.draw();
      }
    });
    this.draw();
    return this.wrapper;
  }

  draw() {
    const items = this.data.items
      .map(
        ({ snapshot = {}, line }, i) => `
      <div class="roundup-item">
        <p class="article-card-meta">${escapeHtml([snapshot.work, snapshot.author].filter(Boolean).join(' · '))}</p>
        <p class="article-card-title">${escapeHtml(snapshot.title || 'Untitled')}</p>
        <textarea rows="2" data-line="${i}" placeholder="Your line about it"${this.readOnly ? ' disabled' : ''}>${escapeHtml(line || '')}</textarea>
        ${this.readOnly ? '' : `<button type="button" class="link-button" data-remove="${i}">remove</button>`}
      </div>`,
      )
      .join('');
    this.wrapper.innerHTML = `<div class="roundup-items">${items}</div>
      <div class="roundup-search"></div>
      ${this.readOnly || this.adding ? '' : '<button type="button" class="link-button roundup-add">+ add link</button>'}`;
    if (this.adding && !this.readOnly) {
      createShortformSearch(
        this.wrapper.querySelector('.roundup-search'),
        (entry) => {
          this.data.items.push({
            ref: entry._id,
            line: '',
            snapshot: snapshotOf(entry),
          });
          this.adding = false;
          this.draw();
          this.wrapper
            .querySelector(`[data-line="${this.data.items.length - 1}"]`)
            ?.focus();
        },
      ).focus();
    }
  }

  save() {
    return this.data;
  }

  validate(data) {
    return data.items.length > 0;
  }
}
