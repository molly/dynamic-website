import { escapeHtml } from '../helpers/escapeHtml.js';
import { createShortformSearch, snapshotOf } from './shortformSearch.js';

// "Linked article" block: a card for a shortform reading entry, with the excerpts you choose.
// Data: { ref, excerpts: [string], snapshot: { title, href, work, author } }
// The site shows the entry's current details; the snapshot is for threads and as a fallback.

export default class ArticleTool {
  static get toolbox() {
    return {
      title: 'Linked article',
      icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M8 7h9v9"/></svg>',
    };
  }

  static get isReadOnlySupported() {
    return true;
  }

  constructor({ data, readOnly }) {
    this.readOnly = readOnly;
    this.data = { excerpts: [], ...data };
    this.entry = null; // Full entry, when picked in this session (has its saved excerpts)
  }

  render() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'article-tool';
    // Typing in the card shouldn't trigger the editor's keyboard handling.
    this.wrapper.addEventListener('keydown', (evt) => evt.stopPropagation());
    this.draw();
    return this.wrapper;
  }

  draw() {
    if (!this.data.ref) {
      createShortformSearch(this.wrapper, (entry) => {
        this.entry = entry;
        this.data = {
          ref: entry._id,
          snapshot: snapshotOf(entry),
          excerpts: (entry.excerpts || []).slice(0, 1),
        };
        this.draw();
      }).focus();
      return;
    }
    const { snapshot = {}, excerpts } = this.data;
    const choices = [
      ...new Set([...(this.entry?.excerpts || []), ...excerpts]),
    ];
    this.wrapper.innerHTML = `
      <div class="article-card">
        <p class="article-card-meta">${escapeHtml([snapshot.work, snapshot.author].filter(Boolean).join(' · '))}</p>
        <p class="article-card-title">${escapeHtml(snapshot.title || 'Untitled')}</p>
        <div class="article-excerpts">${choices
          .map(
            (excerpt, i) => `
          <label class="article-excerpt"><input type="checkbox" data-excerpt="${i}"${excerpts.includes(excerpt) ? ' checked' : ''}${this.readOnly ? ' disabled' : ''}>
            <span>“${escapeHtml(excerpt)}</span></label>`,
          )
          .join('')}</div>
        ${
          this.readOnly
            ? ''
            : `<textarea class="article-new-excerpt" rows="2" placeholder="Add an excerpt"></textarea>
          <p class="article-actions"><button type="button" class="link-button article-add">+ add excerpt</button>
            · <button type="button" class="link-button article-change">choose a different article</button></p>`
        }
      </div>`;
    this.choices = choices;
    this.wrapper.querySelector('.article-excerpts').onchange = () => {
      this.data.excerpts = [
        ...this.wrapper.querySelectorAll('[data-excerpt]:checked'),
      ].map((box) => this.choices[box.dataset.excerpt]);
    };
    const add = this.wrapper.querySelector('.article-add');
    if (add) {
      add.onclick = () => {
        const text = this.wrapper
          .querySelector('.article-new-excerpt')
          .value.trim();
        if (text) {
          this.data.excerpts.push(text);
          this.draw();
        }
      };
      this.wrapper.querySelector('.article-change').onclick = () => {
        this.data = { excerpts: [] };
        this.entry = null;
        this.draw();
      };
    }
  }

  save() {
    return this.data;
  }

  validate(data) {
    return Boolean(data.ref);
  }
}
