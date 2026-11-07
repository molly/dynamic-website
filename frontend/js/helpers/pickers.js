import axios from 'axios';
import TomSelect from 'tom-select';
import { ENTITY_TYPES } from '../../../api/helpers/entityTypes.js';
import { parseProfileUrl } from '../../../api/helpers/profileUrl.js';
import {
  MENTION_NETWORKS,
  NETWORK_LABELS,
} from '../../../api/helpers/socialMedia.js';
import { escapeHtml } from './escapeHtml.js';

// Shared by the micro editor and the tagger page.

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

// Feed entries -----------------------------------------------------------------------------------

const KIND_LABELS = {
  FeedEntryMicro: 'post',
  FeedEntryCitationNeeded: 'Citation Needed',
  FeedEntryPress: 'press',
};

/**
 * Multi-select of feed entries (posts, newsletter issues, press), in the order they're picked.
 * @param {string} selector Input element for the picker
 * @param {Object} options
 * @param {Object[]} options.initial Labelled entries already chosen: { _id, label, type, createdAt }
 * @param {() => ?string} options.getExclude This entry's own feed entry id, to leave out
 * @param {(ids: string[]) => void} [options.onChange]
 * @returns {TomSelect}
 */
export function createEntryPicker(
  selector,
  { initial = [], getExclude = () => null, onChange = () => {} },
) {
  const picker = new TomSelect(selector, {
    options: initial,
    items: initial.map((entry) => entry._id),
    valueField: '_id',
    labelField: 'label',
    searchField: ['label'],
    maxItems: null,
    closeAfterSelect: true,
    preload: 'focus',
    // The server already searched the posts' text; don't let the client filter on labels.
    score: () => () => 1,
    load(query, callback) {
      axios
        .get('/dynamic-api/feed/entries/search', {
          params: {
            q: query,
            kinds: 'micro,citationNeeded,press',
            exclude: getExclude() || undefined,
          },
        })
        .then(({ data }) => callback(data))
        .catch((err) => {
          console.error(err);
          callback();
        });
    },
    render: {
      option: (entry, escape) =>
        `<div>${escape(entry.label)} <span class="picker-meta">${escape(KIND_LABELS[entry.type] || '')} · ${escape(String(entry.createdAt || '').slice(0, 10))}</span></div>`,
      item: (entry, escape) => `<div>${escape(entry.label)}</div>`,
    },
  });
  picker.on('change', () => onChange(selectedValues(picker)));
  return picker;
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
 * @param {?number} [options.maxItems] 1 for a single entity; unlimited by default
 * @returns {TomSelect}
 */
export function createAboutPicker(
  selector,
  { initial = [], onChange = () => {}, maxItems = null },
) {
  const picker = new TomSelect(selector, {
    options: initial,
    items: initial.map((e) => e._id),
    valueField: '_id',
    labelField: 'name',
    searchField: ['name'],
    maxItems,
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
      option: (entity, escape) => {
        const accounts = entity.accounts?.length
          ? ` · ${entity.accounts.length} account${entity.accounts.length === 1 ? '' : 's'}`
          : '';
        return `<div><span class="entity-at">@</span>${escape(entityLabel(entity))} <span class="picker-meta">${escape(entity.type)}${accounts}</span></div>`;
      },
      item: (entity, escape) =>
        `<div><span class="entity-at">@</span>${escape(entityLabel(entity))}</div>`,
      option_create: (data, escape) =>
        `<div class="create">+ new entity “${escape(data.input)}”</div>`,
    },
  });
  picker.on('change', () => onChange(selectedValues(picker)));
  return picker;
}

// New entity dialog ------------------------------------------------------------------------------

// Type is one click; "other" reveals the less common types.
const MAIN_TYPES = [
  { value: 'person', label: 'person' },
  { value: 'organization', label: 'org' },
  { value: 'committee', label: 'committee' },
  { value: 'case', label: 'case' },
  { value: 'bill', label: 'bill' },
];
const OTHER_TYPES = ENTITY_TYPES.filter(
  (type) => !MAIN_TYPES.some((main) => main.value === type),
);
// Wikipedia first: it's the most common account for people mentioned.
const ACCOUNT_NETWORKS = [
  'wikipedia',
  ...MENTION_NETWORKS.filter((network) => network !== 'wikipedia'),
];

let dialog;

function accountRow({ network = 'wikipedia', handle = '' } = {}) {
  const row = document.createElement('div');
  row.className = 'entity-account-row';
  row.innerHTML = `
    <select name="network" aria-label="Network">
      ${ACCOUNT_NETWORKS.map(
        (n) =>
          `<option value="${n}"${n === network ? ' selected' : ''}>${NETWORK_LABELS[n]}</option>`,
      ).join('')}
    </select>
    <input name="handle" type="text" placeholder="handle" aria-label="Handle" value="${escapeHtml(handle)}">
    <button type="button" class="remove-account link-button" aria-label="Remove account">×</button>`;
  return row;
}

function buildDialog() {
  dialog = document.createElement('dialog');
  dialog.className = 'entity-dialog';
  dialog.innerHTML = `
    <form method="dialog" novalidate>
      <h2>New entity</h2>
      <p class="dialog-subtitle">will be mentioned as <span class="mentioned-as"></span></p>

      <label class="field-label" for="entity-name">Name</label>
      <input id="entity-name" name="name" type="text" required>

      <span class="field-label" id="entity-type-label">Type</span>
      <div class="segmented" role="group" aria-labelledby="entity-type-label">
        ${MAIN_TYPES.map(
          (t) =>
            `<button type="button" data-type="${t.value}">${t.label}</button>`,
        ).join('')}
        <button type="button" data-type="other">other</button>
      </div>
      <select name="otherType" class="entity-other-type" aria-label="Other type" hidden>
        ${OTHER_TYPES.map((t) => `<option value="${t}">${t}</option>`).join('')}
      </select>

      <p class="entity-similar" hidden>
        similar name exists: <span class="similar-names"></span> ·
        <button type="button" class="link-button tell-apart">add a note to tell them apart</button>
      </p>
      <div class="entity-disambiguator" hidden>
        <label class="field-label" for="entity-disambiguator">Note to tell them apart</label>
        <input id="entity-disambiguator" name="disambiguator" type="text"
          placeholder="e.g. journalist, or the company's full name">
      </div>

      <span class="field-label">Accounts <span class="field-hint">· paste a profile URL and the platform fills in</span></span>
      <div class="entity-account-rows"></div>
      <input class="entity-paste" type="text" placeholder="paste URL or handle…" aria-label="Paste a profile URL or handle">

      <label class="checkbox-label">
        <input type="checkbox" name="hasPage"> give them a public entity page
      </label>

      <div class="entity-matches" hidden></div>
      <p class="entity-error" hidden></p>
      <div class="dialog-buttons">
        <button type="button" class="cancel link-button">Cancel</button>
        <button type="submit" class="primary">Create &amp; add</button>
      </div>
    </form>`;
  document.body.appendChild(dialog);

  dialog
    .querySelector('.entity-account-rows')
    .addEventListener('click', (evt) => {
      if (evt.target.classList.contains('remove-account')) {
        evt.target.closest('.entity-account-row').remove();
      }
    });
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
  const nameInput = form.elements.name;
  const mentionedAs = dialog.querySelector('.mentioned-as');
  const segmented = dialog.querySelector('.segmented');
  const otherType = dialog.querySelector('.entity-other-type');
  const similar = dialog.querySelector('.entity-similar');
  const disambiguator = dialog.querySelector('.entity-disambiguator');
  const rows = dialog.querySelector('.entity-account-rows');
  const paste = dialog.querySelector('.entity-paste');
  const hasPage = form.elements.hasPage;
  const matches = dialog.querySelector('.entity-matches');
  const error = dialog.querySelector('.entity-error');

  form.reset();
  nameInput.value = name;
  rows.innerHTML = '';
  for (const element of [similar, disambiguator, matches, error, otherType]) {
    element.hidden = true;
  }

  let type = 'person';
  let hasPageTouched = false;
  const selectType = (value) => {
    type = value;
    for (const button of segmented.querySelectorAll('button')) {
      button.setAttribute(
        'aria-pressed',
        String(button.dataset.type === value),
      );
    }
    otherType.hidden = value !== 'other';
    if (!hasPageTouched) {
      // Same default as the model: people are mention-only, everything else gets a page.
      hasPage.checked = value !== 'person';
    }
  };
  selectType('person');

  const updateMentionedAs = () => {
    mentionedAs.textContent = `@${nameInput.value.trim() || '…'}`;
  };
  updateMentionedAs();

  // Warn about similar names as you type, before anything is submitted.
  let checkTimeout;
  let checkSequence = 0;
  const checkSimilar = () => {
    clearTimeout(checkTimeout);
    const value = nameInput.value.trim();
    if (!value) {
      similar.hidden = true;
      return;
    }
    checkTimeout = setTimeout(async () => {
      const sequence = ++checkSequence;
      try {
        const { data } = await axios.get('/dynamic-api/entities/check', {
          params: { name: value },
        });
        if (sequence !== checkSequence) {
          return; // A newer check has started
        }
        similar.querySelector('.similar-names').textContent = data.similar
          .map(entityLabel)
          .join(', ');
        similar.hidden = data.similar.length === 0;
      } catch (err) {
        console.error(err);
      }
    }, 300);
  };
  checkSimilar();

  const addPastedAccount = () => {
    const value = paste.value.trim();
    if (!value) {
      return;
    }
    // Unrecognized text still becomes a row, so the network can be picked by hand.
    rows.appendChild(accountRow(parseProfileUrl(value) || { handle: value }));
    paste.value = '';
  };

  const readFields = () => ({
    name: nameInput.value.trim(),
    type: type === 'other' ? otherType.value : type,
    disambiguator: form.elements.disambiguator.value.trim() || undefined,
    hasPage: hasPage.checked,
    accounts: [...rows.querySelectorAll('.entity-account-row')]
      .map((row) => ({
        network: row.querySelector('[name=network]').value,
        handle: row.querySelector('[name=handle]').value.trim(),
      }))
      .filter((account) => account.handle),
  });

  return new Promise((resolve) => {
    let shownMatches = [];
    const listeners = [];
    const listen = (element, event, handler) => {
      element.addEventListener(event, handler);
      listeners.push([element, event, handler]);
    };
    const finish = (result) => {
      clearTimeout(checkTimeout);
      for (const [element, event, handler] of listeners) {
        element.removeEventListener(event, handler);
      }
      dialog.close();
      resolve(result);
    };

    const showDisambiguator = () => {
      disambiguator.hidden = false;
      form.elements.disambiguator.focus();
    };

    const showMatches = (reason, entities) => {
      const intro =
        reason === 'id'
          ? 'One of these accounts or IDs already belongs to:'
          : 'An entity with this name exists. Add a note to tell them apart, or use the existing one:';
      matches.innerHTML = `<p>${intro}</p><ul>${entities
        .map(
          (entity) =>
            `<li>${escapeHtml(entityLabel(entity))} <span class="picker-meta">${escapeHtml(entity.type)}</span> <button type="button" class="link-button" data-id="${escapeHtml(entity._id)}">use this</button></li>`,
        )
        .join('')}</ul>`;
      matches.hidden = false;
      shownMatches = entities;
      if (reason === 'name') {
        showDisambiguator();
      }
    };

    listen(nameInput, 'input', () => {
      updateMentionedAs();
      checkSimilar();
    });
    listen(segmented, 'click', (evt) => {
      if (evt.target.dataset?.type) {
        selectType(evt.target.dataset.type);
      }
    });
    listen(hasPage, 'change', () => {
      hasPageTouched = true;
    });
    listen(similar.querySelector('.tell-apart'), 'click', showDisambiguator);
    listen(paste, 'paste', () => setTimeout(addPastedAccount)); // After the text lands
    listen(paste, 'keydown', (evt) => {
      if (evt.key === 'Enter') {
        evt.preventDefault();
        addPastedAccount();
      }
    });
    listen(paste, 'change', addPastedAccount);
    listen(matches, 'click', (evt) => {
      const id = evt.target.dataset?.id;
      if (id) {
        finish(shownMatches.find((entity) => entity._id === id));
      }
    });
    listen(form, 'submit', async (evt) => {
      evt.preventDefault();
      error.hidden = true;
      addPastedAccount();
      const fields = readFields();
      if (!fields.name) {
        error.textContent = 'A name is required.';
        error.hidden = false;
        return;
      }
      try {
        const { data } = await axios.post('/dynamic-api/entities', fields);
        finish(data);
      } catch (err) {
        if (err.response?.status === 409) {
          showMatches(err.response.data.reason, err.response.data.matches);
        } else {
          error.textContent = err.response?.data?.error || err.message;
          error.hidden = false;
        }
      }
    });
    const onCancel = (evt) => {
      evt?.preventDefault();
      finish(null);
    };
    listen(dialog.querySelector('.cancel'), 'click', onCancel);
    listen(dialog, 'cancel', onCancel);

    dialog.showModal();
    nameInput.focus();
  });
}
