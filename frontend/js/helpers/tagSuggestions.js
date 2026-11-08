import axios from 'axios';
import { escapeHtml } from './escapeHtml.js';
import { selectedValues } from './pickers.js';

// Entities and feed tags linked to each other (an entity's "tag" field): adding #coinbase suggests
// @Coinbase for "about", and adding @Coinbase suggests #coinbase. A suggestion is one click to
// add, under its picker, and goes away once it's added or the thing that suggested it is removed.

/**
 * @param {{tagSelect: import('tom-select').default, aboutPicker: import('tom-select').default}}
 *   pickers The editor's tag and "about" pickers
 */
export async function suggestBetweenTagsAndAbout({ tagSelect, aboutPicker }) {
  let entities;
  try {
    ({ data: entities } = await axios.get('/dynamic-api/entities/tagged'));
  } catch (err) {
    console.error('Couldn’t load tagged entities', err);
    return;
  }
  if (!entities.length) {
    return;
  }

  const box = (picker, intro) => {
    const element = document.createElement('p');
    element.className = 'picker-suggestions';
    element.hidden = true;
    element.dataset.intro = intro;
    picker.wrapper.after(element);
    return element;
  };
  const aboutBox = box(aboutPicker, 'from tags');
  const tagBox = box(tagSelect, 'from about');

  const show = (element, buttons) => {
    element.hidden = !buttons.length;
    element.innerHTML = buttons.length
      ? `<span class="side-hint">${element.dataset.intro}:</span> ${buttons.join(' ')}`
      : '';
  };
  const render = () => {
    const tags = new Set(selectedValues(tagSelect));
    const about = new Set(selectedValues(aboutPicker));
    show(
      aboutBox,
      entities
        .filter((e) => tags.has(String(e.tag)) && !about.has(e._id))
        .map(
          (e) =>
            `<button type="button" class="link-button" data-entity="${escapeHtml(e._id)}">+ @${escapeHtml(e.name)}</button>`,
        ),
    );
    show(
      tagBox,
      entities
        .filter(
          (e) =>
            about.has(e._id) &&
            !tags.has(String(e.tag)) &&
            tagSelect.options[String(e.tag)],
        )
        .map((e) => String(e.tag))
        .filter((tag, i, all) => all.indexOf(tag) === i)
        .map(
          (tag) =>
            `<button type="button" class="link-button" data-tag="${escapeHtml(tag)}">+ #${escapeHtml(tagSelect.options[tag].text)}</button>`,
        ),
    );
  };

  aboutBox.addEventListener('click', (evt) => {
    const id = evt.target.closest('[data-entity]')?.dataset.entity;
    const entity = entities.find((e) => e._id === id);
    if (entity) {
      aboutPicker.addOption({ ...entity });
      aboutPicker.addItem(id);
    }
  });
  tagBox.addEventListener('click', (evt) => {
    const tag = evt.target.closest('[data-tag]')?.dataset.tag;
    if (tag) {
      tagSelect.addItem(tag);
    }
  });
  tagSelect.on('change', render);
  aboutPicker.on('change', render);
  render();
}
