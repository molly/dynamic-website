import axios from 'axios';
import TomSelect from 'tom-select';
import { ENTITY_TYPES } from '../../../api/helpers/entityTypes.js';
import { NETWORKS } from '../../../api/helpers/socialMedia.js';

// Shared by the micro editor and the tagger page.

const escapeHtml = (text) =>
  String(text ?? '').replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char],
  );

/**
 * Selected values of a multi-select TomSelect, always as an array of ids.
 * @param {TomSelect} select
 * @returns {string[]}
 */
export function selectedValues(select) {
  const value = select.getValue();
  if (Array.isArray(value)) {
    return value;
  }
  return value ? value.split(',') : [];
}

// Threads ----------------------------------------------------------------------------------------

const threadLabel = (thread) => thread.title || 'Untitled thread';

/**
 * Multi-select for FeedEntry.threads, with inline creation and a preview of this entry's previous
 * and next entries in each selected thread.
 * @param {string} selector Input element for the picker
 * @param {Object} options
 * @param {Object[]} options.initial Populated threads already on the entry
 * @param {HTMLElement} options.preview Element to show previous/next in
 * @param {() => {at?: string, feedEntryId?: string}} options.getPosition Where this entry sits:
 *   its feed entry's createdAt and id, or nothing for an unsaved entry
 * @param {(ids: string[]) => void} [options.onChange]
 * @returns {Promise<TomSelect>}
 */
export async function createThreadPicker(
  selector,
  { initial = [], preview, getPosition, onChange = () => {} },
) {
  const { data: threads } = await axios.get('/dynamic-api/threads');
  const options = [
    ...initial,
    ...threads.filter((t) => !initial.some((i) => i._id === t._id)),
  ];

  const picker = new TomSelect(selector, {
    options,
    items: initial.map((t) => t._id),
    valueField: '_id',
    labelField: 'title',
    searchField: ['title'],
    maxItems: null,
    maxOptions: null,
    closeAfterSelect: true,
    create(title, callback) {
      axios
        .post('/dynamic-api/threads', { title })
        .then(({ data }) => callback(data))
        .catch((err) => {
          if (err.response?.status === 409 && err.response.data.existing) {
            callback(err.response.data.existing);
          } else {
            console.error(err);
            callback();
          }
        });
    },
    render: {
      option: (thread, escape) =>
        `<div>${escape(threadLabel(thread))} <span class="picker-meta">${thread.count ?? 0} entries</span></div>`,
      item: (thread, escape) => `<div>${escape(threadLabel(thread))}</div>`,
      option_create: (data, escape) =>
        `<div class="create">New thread: <strong>${escape(data.input)}</strong></div>`,
    },
  });

  const renderPreview = async () => {
    const ids = selectedValues(picker);
    if (!ids.length) {
      preview.innerHTML = '';
      return;
    }
    const { at, feedEntryId } = getPosition();
    const params = new URLSearchParams();
    if (at) {
      params.set('at', at);
    }
    if (feedEntryId) {
      params.set('exclude', feedEntryId);
    }
    const rows = await Promise.all(
      ids.map(async (id) => {
        const { data } = await axios.get(
          `/dynamic-api/threads/${id}/neighbors?${params}`,
        );
        const thread = picker.options[id];
        const previous = data.previous
          ? `← ${escapeHtml(data.previous.label)}`
          : 'first in thread';
        const next = data.next ? `${escapeHtml(data.next.label)} →` : 'latest';
        return `<li><strong>${escapeHtml(threadLabel(thread))}:</strong> ${previous} · <em>this entry</em> · ${next}</li>`;
      }),
    );
    preview.innerHTML = `<ul>${rows.join('')}</ul>`;
  };

  picker.on('change', () => {
    onChange(selectedValues(picker));
    renderPreview().catch(console.error);
  });
  renderPreview().catch(console.error);
  return picker;
}

// About (entities) -------------------------------------------------------------------------------

const entityLabel = (entity) =>
  entity.disambiguator
    ? `${entity.name} (${entity.disambiguator})`
    : entity.name;

/**
 * Multi-select for FeedEntry.about. Search runs on the server (names, aliases and handles), and
 * "new entity" opens a dialog that checks for duplicates before creating anything.
 * @param {string} selector Input element for the picker
 * @param {Object} options
 * @param {Object[]} options.initial Populated entities already on the entry
 * @param {(ids: string[]) => void} [options.onChange]
 * @returns {TomSelect}
 */
export function createAboutPicker(
  selector,
  { initial = [], onChange = () => {} },
) {
  const picker = new TomSelect(selector, {
    options: initial,
    items: initial.map((e) => e._id),
    valueField: '_id',
    labelField: 'name',
    searchField: ['name'],
    maxItems: null,
    closeAfterSelect: true,
    // The server already matched aliases and handles; don't let the client filter those out.
    score: () => () => 1,
    load(query, callback) {
      axios
        .get('/dynamic-api/entities', { params: { q: query } })
        .then(({ data }) => callback(data))
        .catch((err) => {
          console.error(err);
          callback();
        });
    },
    create(name, callback) {
      openEntityDialog({ name })
        .then((entity) => callback(entity || undefined))
        .catch((err) => {
          console.error(err);
          callback();
        });
    },
    render: {
      option: (entity, escape) =>
        `<div>${escape(entityLabel(entity))} <span class="picker-meta">${escape(entity.type)}</span></div>`,
      item: (entity, escape) => `<div>${escape(entityLabel(entity))}</div>`,
      option_create: (data, escape) =>
        `<div class="create">New entity: <strong>${escape(data.input)}</strong>…</div>`,
    },
  });
  picker.on('change', () => onChange(selectedValues(picker)));
  return picker;
}

// New entity dialog ------------------------------------------------------------------------------

let dialog;

function buildDialog() {
  dialog = document.createElement('dialog');
  dialog.className = 'entity-dialog';
  dialog.innerHTML = `
    <form method="dialog">
      <h2>New entity</h2>
      <div class="input-group">
        <label for="entity-name">Name</label>
        <input id="entity-name" name="name" type="text" required>
      </div>
      <div class="input-group">
        <label for="entity-type">Type</label>
        <select id="entity-type" name="type">
          ${ENTITY_TYPES.map((t) => `<option value="${t}">${t}</option>`).join('')}
        </select>
      </div>
      <div class="input-group">
        <label for="entity-disambiguator">Disambiguator</label>
        <input id="entity-disambiguator" name="disambiguator" type="text"
          placeholder="Only needed if another entity has the same name">
      </div>
      <fieldset class="entity-accounts">
        <legend>Accounts</legend>
        <div class="entity-account-rows"></div>
        <button type="button" class="add-account">Add account</button>
      </fieldset>
      <div class="entity-matches" hidden></div>
      <p class="entity-error" hidden></p>
      <div class="dialog-buttons">
        <button type="submit" value="create">Create</button>
        <button type="button" class="cancel">Cancel</button>
      </div>
    </form>
    <template class="entity-account-row">
      <div class="entity-account-row">
        <select name="network">
          ${NETWORKS.map((n) => `<option value="${n}">${n}</option>`).join('')}
        </select>
        <input name="handle" type="text" placeholder="handle">
        <button type="button" class="remove-account" aria-label="Remove account">×</button>
      </div>
    </template>`;
  document.body.appendChild(dialog);

  const rows = dialog.querySelector('.entity-account-rows');
  dialog.querySelector('.add-account').addEventListener('click', () => {
    rows.appendChild(
      dialog
        .querySelector('template.entity-account-row')
        .content.cloneNode(true),
    );
  });
  rows.addEventListener('click', (evt) => {
    if (evt.target.classList.contains('remove-account')) {
      evt.target.closest('.entity-account-row').remove();
    }
  });
}

function readDialogFields() {
  const form = dialog.querySelector('form');
  const accounts = [...dialog.querySelectorAll('.entity-account-row')]
    .map((row) => ({
      network: row.querySelector('[name=network]').value,
      handle: row.querySelector('[name=handle]').value.trim(),
    }))
    .filter((account) => account.handle);
  return {
    name: form.elements.name.value.trim(),
    type: form.elements.type.value,
    disambiguator: form.elements.disambiguator.value.trim() || undefined,
    accounts,
  };
}

/**
 * Ask for a new entity's details, check for duplicates, and create it.
 * @param {{name?: string}} prefill
 * @returns {Promise<Object|null>} The new or chosen existing entity, or null if cancelled
 */
export function openEntityDialog({ name = '' } = {}) {
  if (!dialog) {
    buildDialog();
  }
  const form = dialog.querySelector('form');
  const matches = dialog.querySelector('.entity-matches');
  const error = dialog.querySelector('.entity-error');
  form.reset();
  form.elements.name.value = name;
  dialog.querySelector('.entity-account-rows').innerHTML = '';
  matches.hidden = true;
  error.hidden = true;

  return new Promise((resolve) => {
    let shownMatches = [];
    const finish = (result) => {
      form.removeEventListener('submit', onSubmit);
      matches.removeEventListener('click', onUseExisting);
      dialog.querySelector('.cancel').removeEventListener('click', onCancel);
      dialog.removeEventListener('cancel', onCancel);
      dialog.close();
      resolve(result);
    };

    const showMatches = (reason, entities) => {
      const intro =
        reason === 'id'
          ? 'One of these IDs or accounts already belongs to:'
          : 'Did you mean one of these? To create a separate entity anyway, add a disambiguator.';
      matches.innerHTML = `<p>${intro}</p><ul>${entities
        .map(
          (entity) =>
            `<li>${escapeHtml(entityLabel(entity))} <span class="picker-meta">${escapeHtml(entity.type)}</span> <button type="button" data-id="${escapeHtml(entity._id)}">Use this</button></li>`,
        )
        .join('')}</ul>`;
      matches.hidden = false;
      shownMatches = entities;
      if (reason === 'name') {
        form.elements.disambiguator.focus();
      }
    };

    const onSubmit = async (evt) => {
      evt.preventDefault();
      error.hidden = true;
      try {
        const { data } = await axios.post(
          '/dynamic-api/entities',
          readDialogFields(),
        );
        finish(data);
      } catch (err) {
        if (err.response?.status === 409) {
          showMatches(err.response.data.reason, err.response.data.matches);
        } else {
          error.textContent = err.response?.data?.error || err.message;
          error.hidden = false;
        }
      }
    };
    const onUseExisting = (evt) => {
      const id = evt.target.dataset?.id;
      if (id) {
        finish(shownMatches.find((entity) => entity._id === id));
      }
    };
    const onCancel = (evt) => {
      evt?.preventDefault();
      finish(null);
    };

    form.addEventListener('submit', onSubmit);
    matches.addEventListener('click', onUseExisting);
    dialog.querySelector('.cancel').addEventListener('click', onCancel);
    dialog.addEventListener('cancel', onCancel);
    dialog.showModal();
    form.elements.name.focus();
  });
}
