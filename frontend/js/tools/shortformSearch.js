import axios from 'axios';
import debounce from 'lodash.debounce';
import { escapeHtml } from '../helpers/escapeHtml.js';

// A search box for shortform reading entries, used by the article card and roundup blocks.

/**
 * What a block keeps of an entry, so threads and fallbacks don't need to look it up again.
 * @param {Object} entry
 */
export function snapshotOf(entry) {
  return {
    title: entry.title,
    href: entry.href,
    work: entry.work,
    author: entry.author,
  };
}

/**
 * Render a search box into a container; calls onPick(entry) with the chosen entry.
 * @param {HTMLElement} container
 * @param {(entry: Object) => void} onPick
 */
export function createShortformSearch(container, onPick) {
  container.innerHTML = `
    <input type="text" class="shortform-search" placeholder="Search your reading list by title, outlet or author" aria-label="Search your reading list">
    <ul class="shortform-results"></ul>`;
  const input = container.querySelector('input');
  const list = container.querySelector('ul');
  let results = [];
  let sequence = 0;

  const search = async () => {
    const mine = ++sequence;
    const { data } = await axios.get('/dynamic-api/shortform/search', {
      params: { q: input.value },
    });
    if (mine !== sequence) {
      return;
    }
    results = data;
    list.innerHTML = results.length
      ? results
          .map(
            (entry) =>
              `<li><button type="button" data-id="${escapeHtml(entry._id)}">${escapeHtml(entry.title)} <span class="picker-meta">${escapeHtml([entry.work, entry.author].filter(Boolean).join(' · '))}</span></button></li>`,
          )
          .join('')
      : '<li class="side-hint">Nothing found.</li>';
  };

  // Typing here shouldn't trigger the editor's keyboard handling.
  container.addEventListener('keydown', (evt) => {
    evt.stopPropagation();
    if (evt.key === 'Enter') {
      evt.preventDefault();
      list.querySelector('button')?.click();
    }
  });
  input.addEventListener(
    'input',
    debounce(() => search().catch(console.error), 200),
  );
  list.addEventListener('click', (evt) => {
    const id = evt.target.closest('button')?.dataset.id;
    if (id) {
      onPick(results.find((entry) => entry._id === id));
    }
  });
  search().catch(console.error);
  return input;
}
