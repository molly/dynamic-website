import axios from 'axios';
import debounce from 'lodash.debounce';
import { escapeHtml } from './helpers/escapeHtml.js';
import { openEntityDialog } from './helpers/pickers.js';

// Inline tool for mentioning an entity. Select the words, press @, and pick the entity (or create
// one). The post stores only <span class="mention" data-entity="id">words</span>; the entity's
// links and handles are added when the post is shown or cross-posted.

const MENTION_CLASS = 'mention';
const LEGACY_CLASS = 'cdx-mention';

const entityLabel = (entity) =>
  entity.disambiguator
    ? `${entity.name} (${entity.disambiguator})`
    : entity.name;

export default class MentionsTool {
  static get isInline() {
    return true;
  }

  static get title() {
    return 'Mention';
  }

  static get sanitize() {
    return {
      span: (el) => {
        if (el.dataset?.entity) {
          return { class: true, 'data-entity': true };
        }
        // Legacy mentions written by the previous version of this tool
        return { class: true, style: true };
      },
      svg: (el) => el.parentElement?.classList.contains('cdx-mention-icon'),
      path: (el) =>
        el.parentElement?.parentElement?.classList.contains('cdx-mention-icon'),
      a: (el) =>
        el.classList.contains('u-url')
          ? {
              href: true,
              class: true,
              title: true,
              'data-username': true,
              style: true,
            }
          : { href: true, target: true, rel: true, style: true },
    };
  }

  constructor({ api }) {
    this.api = api;
    this.button = null;
    this.state = false;
    this.range = null;
    this.searchSequence = 0;
  }

  render() {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.textContent = '@';
    this.button.title = 'Mention a person, organization or other entity';
    this.button.classList.add(this.api.styles.inlineToolButton);
    return this.button;
  }

  findMention() {
    return (
      this.api.selection.findParentTag('SPAN', MENTION_CLASS) ||
      this.api.selection.findParentTag('SPAN', LEGACY_CLASS)
    );
  }

  surround(range) {
    const mention = this.findMention();
    if (mention) {
      this.unwrap(mention);
      return;
    }
    // Keep the selection: the search box takes focus before an entity is picked.
    this.range = range.cloneRange();
    this.openSearch(range.toString().trim());
  }

  checkState() {
    const mention = this.findMention();
    this.state = Boolean(mention);
    this.button?.classList.toggle(
      this.api.styles.inlineToolButtonActive,
      this.state,
    );
    if (mention) {
      this.showCurrent(mention);
    } else if (!this.searching) {
      this.hideActions();
    }
    return this.state;
  }

  renderActions() {
    this.actions = document.createElement('div');
    this.actions.className = 'mention-actions';
    this.actions.hidden = true;
    this.actions.addEventListener('mousedown', (evt) => {
      // Clicking a result shouldn't move the editor's selection.
      if (evt.target.closest('button')) {
        evt.preventDefault();
      }
    });
    this.actions.addEventListener('click', (evt) => this.onActionClick(evt));
    return this.actions;
  }

  // Search ---------------------------------------------------------------------------------------

  openSearch(text) {
    this.searching = true;
    this.actions.innerHTML = `
      <input type="text" class="mention-search" placeholder="Search people, organizations…" aria-label="Search entities">
      <ul class="mention-results" role="listbox"></ul>`;
    this.actions.hidden = false;
    const input = this.actions.querySelector('.mention-search');
    input.value = text;
    input.addEventListener(
      'input',
      debounce(() => this.search(input.value), 200),
    );
    input.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter') {
        evt.preventDefault();
        this.actions.querySelector('.mention-results button')?.click();
      } else if (evt.key === 'Escape') {
        this.closeSearch();
      }
    });
    input.focus();
    this.search(text);
  }

  async search(query) {
    const sequence = ++this.searchSequence;
    const list = this.actions.querySelector('.mention-results');
    if (!list) {
      return;
    }
    let results = [];
    try {
      ({ data: results } = await axios.get('/dynamic-api/entities', {
        params: { q: query },
      }));
    } catch (err) {
      console.error(err);
    }
    if (sequence !== this.searchSequence) {
      return; // A newer search has started
    }
    this.results = results;
    list.innerHTML = `${results
      .slice(0, 8)
      .map(
        (entity) =>
          `<li><button type="button" data-entity="${escapeHtml(entity._id)}">@${escapeHtml(entityLabel(entity))} <span class="picker-meta">${escapeHtml(entity.type)}</span></button></li>`,
      )
      .join(
        '',
      )}<li><button type="button" class="mention-create" data-name="${escapeHtml(query)}">+ new entity${query ? ` “${escapeHtml(query)}”` : ''}</button></li>`;
  }

  async onActionClick(evt) {
    const button = evt.target.closest('button');
    if (!button) {
      return;
    }
    if (button.classList.contains('mention-remove')) {
      const mention = this.findMention() || this.currentMention;
      if (mention) {
        this.unwrap(mention);
      }
      this.hideActions();
      return;
    }
    if (button.classList.contains('mention-create')) {
      this.searching = false;
      const entity = await openEntityDialog({ name: button.dataset.name });
      if (entity) {
        this.wrap(entity);
      }
      this.hideActions();
      return;
    }
    if (button.dataset.entity) {
      this.wrap(this.results.find((e) => e._id === button.dataset.entity));
      this.hideActions();
    }
  }

  closeSearch() {
    this.searching = false;
    this.hideActions();
    this.api.inlineToolbar.close();
  }

  // Wrapping -------------------------------------------------------------------------------------

  wrap(entity) {
    if (!this.range || !entity) {
      return;
    }
    const span = document.createElement('span');
    span.className = MENTION_CLASS;
    span.dataset.entity = entity._id;
    span.title = entityLabel(entity);
    span.appendChild(this.range.extractContents());
    this.range.insertNode(span);
    this.range = null;
    this.searching = false;
    this.api.inlineToolbar.close();
  }

  unwrap(mention) {
    // The words as written: legacy mentions keep them in .cdx-mention-plain
    const words =
      mention.querySelector('.cdx-mention-plain')?.textContent ??
      mention.textContent;
    mention.replaceWith(document.createTextNode(words));
  }

  showCurrent(mention) {
    this.currentMention = mention;
    const entityId = mention.dataset.entity;
    this.actions.innerHTML = entityId
      ? `<p class="mention-current">Mentions <strong>${escapeHtml(mention.title || mention.textContent)}</strong> ·
          <a href="/admin/entities/${escapeHtml(entityId)}" target="_blank">edit entity</a> ·
          <button type="button" class="link-button mention-remove">remove mention</button></p>`
      : `<p class="mention-current">Older-style mention ·
          <button type="button" class="link-button mention-remove">remove mention</button></p>`;
    this.actions.hidden = false;
  }

  hideActions() {
    if (this.actions) {
      this.actions.hidden = true;
      this.actions.innerHTML = '';
    }
    this.currentMention = null;
  }

  clear() {
    if (!this.searching) {
      this.hideActions();
    }
  }
}
