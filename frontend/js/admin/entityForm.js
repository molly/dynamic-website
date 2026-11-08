import axios from 'axios';
import TomSelect from 'tom-select';
import {
  SHARED_FIELDS,
  SIDE_SECTIONS,
  fieldsFor,
  sectionOf,
} from '../../../api/helpers/entityFields.js';
import {
  RELATION_KINDS,
  RELATION_LABELS,
  relationLabel,
} from '../../../api/helpers/entityTypes.js';
import { formatPartialDate } from '../../../api/helpers/partialDate.js';
import { fillFromWikidata, wikidataId } from '../../../api/helpers/wikidata.js';
import { createAboutPicker, selectedValues } from '../helpers/pickers.js';
import {
  escapeHtml,
  getPath,
  readControl,
  renderControl,
  setPath,
} from './formHelpers.js';

// Entity editor (pug/views/admin/entity.pug), laid out like the public entity page and styled like
// the post editor. The fields come from api/helpers/entityFields.js; sectionOf says where each one
// goes: the head (name, description, note), a section of its own in the main column, or one of the
// side panel's sections.

let tagPicker;

// Placeholders for the head, which has no labels: it reads like the page it becomes.
const HEAD_PLACEHOLDERS = {
  name: 'Name',
  disambiguator: 'disambiguator · only if another entity has this name',
  description: 'One-line description',
  note: 'Optional note, in your words: why you cover this',
};

// Fields -----------------------------------------------------------------------------------------

function removeButton() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'link-button remove-row';
  button.setAttribute('aria-label', 'Remove');
  button.textContent = '×';
  return button;
}

function renderListRow(field, value = {}) {
  const row = document.createElement('div');
  row.className = 'list-row';
  for (const sub of field.fields) {
    const control = renderControl(sub, value[sub.name]);
    control.dataset.sub = sub.name;
    control.setAttribute('aria-label', sub.label);
    if (control.tagName !== 'SELECT' && !control.placeholder) {
      control.placeholder = sub.label;
    }
    row.appendChild(control);
  }
  row.appendChild(removeButton());
  return row;
}

function renderStringRow(field, value = '') {
  const row = document.createElement('div');
  row.className = 'list-row';
  const input = Object.assign(document.createElement('input'), {
    type: 'text',
    value,
    placeholder: field.label,
  });
  input.dataset.sub = 'value';
  input.setAttribute('aria-label', field.label);
  row.append(input, removeButton());
  return row;
}

// A list of rows (other names, versions, accounts…), with "+ add" under it
function renderListField(field, value, { heading }) {
  const section = document.createElement('fieldset');
  section.className = 'list-field';
  section.dataset.field = field.name;
  section.innerHTML = `<legend class="${heading}">${escapeHtml(field.label)}</legend><div class="list-rows"></div>`;
  const rows = section.querySelector('.list-rows');
  const newRow = (item) =>
    field.input === 'list'
      ? renderListRow(field, item)
      : renderStringRow(field, item);
  for (const item of value || []) {
    rows.appendChild(newRow(item));
  }
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'link-button add-row';
  add.textContent = '+ add';
  add.setAttribute('aria-label', `Add to ${field.label.toLowerCase()}`);
  add.addEventListener('click', () => {
    const row = newRow();
    rows.appendChild(row);
    row.querySelector('input, select')?.focus();
  });
  rows.addEventListener('click', (evt) => {
    if (evt.target.classList.contains('remove-row')) {
      evt.target.closest('.list-row').remove();
    }
  });
  section.appendChild(add);
  if (field.help) {
    section.insertAdjacentHTML(
      'beforeend',
      `<p class="field-help">${escapeHtml(field.help)}</p>`,
    );
  }
  return section;
}

function fieldId(field) {
  return `field-${field.name.replace(/\./g, '-')}`;
}

function simpleControl(field, value) {
  const control =
    field.input === 'tag'
      ? Object.assign(document.createElement('input'), { type: 'text' })
      : renderControl(field, value);
  control.id = fieldId(field);
  control.dataset.control = field.name;
  return control;
}

// The head: name, disambiguator, description and note, unlabeled, in the page's own type
function renderHeadField(field, value) {
  const control = simpleControl(field, value);
  control.classList.add(`entity-head-${field.name}`);
  control.placeholder = HEAD_PLACEHOLDERS[field.name] || field.label;
  control.setAttribute('aria-label', field.label);
  if (control.tagName === 'TEXTAREA') {
    control.rows = 2;
  }
  return control;
}

// A side panel row: a small label, then the control, like "at a glance" on the page
function renderSideRow(field, value) {
  const row = document.createElement('div');
  row.className = 'entity-field-row';
  row.dataset.field = field.name;
  if (field.input === 'checkbox') {
    const label = document.createElement('label');
    label.className = 'entity-check';
    label.append(
      simpleControl(field, value),
      field.name === 'hasPage'
        ? ' give them a public entity page'
        : ` ${field.label}`,
    );
    row.classList.add('entity-field-check');
    row.appendChild(label);
  } else {
    const label = document.createElement('label');
    label.htmlFor = fieldId(field);
    label.textContent = field.label.toLowerCase();
    row.append(label, simpleControl(field, value));
  }
  if (field.help) {
    row.insertAdjacentHTML(
      'beforeend',
      `<p class="field-help">${escapeHtml(field.help)}</p>`,
    );
  }
  return row;
}

// Main column sections: the type's own lists first (versions, candidacies…), then the shared ones
// (other names, sources)
function mainFields(type) {
  const fields = fieldsFor(type).filter((f) => sectionOf(f) === 'main');
  const shared = new Set(SHARED_FIELDS.map((f) => f.name));
  return [
    ...fields.filter((f) => !shared.has(f.name)),
    ...fields.filter((f) => shared.has(f.name)),
  ];
}

async function renderFields(containers, type, entity) {
  const valueOf = (field) => {
    const value = entity ? getPath(entity, field.name) : undefined;
    // Same default as the model: people are mention-only
    return field.name === 'hasPage' && value === undefined
      ? type !== 'person'
      : value;
  };
  const fields = fieldsFor(type);

  containers.head.innerHTML = '';
  for (const field of fields.filter((f) => sectionOf(f) === 'head')) {
    containers.head.appendChild(renderHeadField(field, valueOf(field)));
  }

  containers.main.innerHTML = '';
  for (const field of mainFields(type)) {
    containers.main.appendChild(
      field.input === 'list' || field.input === 'strings'
        ? renderListField(field, valueOf(field), {
            heading: 'entity-editor-heading',
          })
        : renderSideRow(field, valueOf(field)),
    );
  }

  containers.side.innerHTML = '';
  for (const { id, label } of SIDE_SECTIONS) {
    const sectionFields = fields.filter((f) => sectionOf(f) === id);
    if (!sectionFields.length) {
      continue;
    }
    const section = document.createElement('section');
    section.className = 'side-section';
    section.innerHTML = `<h2 class="side-label">${escapeHtml(label)}</h2>`;
    for (const field of sectionFields) {
      section.appendChild(
        field.input === 'list' || field.input === 'strings'
          ? renderListField(field, valueOf(field), { heading: 'side-hint' })
          : renderSideRow(field, valueOf(field)),
      );
    }
    containers.side.appendChild(section);
  }

  // "fill from Wikidata", under the Wikidata ID (setupEntityForm handles the click)
  const wikidataRow = containers.side
    .querySelector('[data-control="ids.wikidata"]')
    ?.closest('.entity-field-row');
  if (wikidataRow) {
    wikidataRow.insertAdjacentHTML(
      'beforeend',
      `<p class="field-help wikidata-fill-row"><button type="button" class="link-button wikidata-fill">fill from Wikidata</button> <span class="wikidata-fill-status" role="status"></span></p>`,
    );
  }

  // The tag field picks one existing tag.
  const { data: tags } = await axios.get('/dynamic-api/tags');
  tagPicker = new TomSelect('#field-tag', {
    options: tags,
    items: entity?.tag ? [entity.tag._id] : [],
    valueField: '_id',
    labelField: 'text',
    searchField: ['text'],
    maxItems: 1,
    allowEmptyOption: true,
  });
}

// Read the whole form back into an entity object. Empty values are left out, which the server
// treats as cleared.
function collectFields(containers, type) {
  const find = (selector, all = false) => {
    for (const container of Object.values(containers)) {
      const found = all
        ? [...container.querySelectorAll(selector)]
        : container.querySelector(selector);
      if (all ? found.length : found) {
        return found;
      }
    }
    return all ? [] : null;
  };
  const data = {};
  for (const field of fieldsFor(type)) {
    let value;
    if (field.input === 'tag') {
      value = tagPicker.getValue() || undefined;
    } else if (field.input === 'strings') {
      value = find(`fieldset[data-field="${field.name}"] .list-row input`, true)
        .map((input) => input.value.trim())
        .filter(Boolean);
    } else if (field.input === 'list') {
      value = find(`fieldset[data-field="${field.name}"] .list-row`, true)
        .map((row) => {
          const item = {};
          for (const sub of field.fields) {
            const subValue = readControl(
              sub,
              row.querySelector(`[data-sub="${sub.name}"]`),
            );
            if (subValue !== undefined) {
              item[sub.name] = subValue;
            }
          }
          return item;
        })
        .filter((item) => Object.keys(item).length > 0);
    } else {
      value = readControl(field, find(`[data-control="${field.name}"]`));
    }
    if (value !== undefined) {
      setPath(data, field.name, value);
    }
  }
  return data;
}

function showMatches(box, reason, matches) {
  const intro =
    reason === 'id'
      ? 'One of these IDs or accounts already belongs to:'
      : 'An entity with this name already exists. Add a disambiguator to save this one separately.';
  box.innerHTML = `<p>${intro}</p><ul>${matches
    .map(
      (match) =>
        `<li><a href="/admin/entities/${escapeHtml(match._id)}" target="_blank">${escapeHtml(match.name)}</a>${match.disambiguator ? ` (${escapeHtml(match.disambiguator)})` : ''} <span class="picker-meta">${escapeHtml(match.type)}</span></li>`,
    )
    .join('')}</ul>`;
  box.hidden = false;
}

const savedAt = () =>
  `saved ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase()}`;

// Relations ------------------------------------------------------------------------------------

// One choice per way a relation can read from this entity's side: "works at" (this entity is
// `from`) and "employs" (this entity is `to`). Symmetric kinds read the same both ways.
const RELATION_CHOICES = RELATION_KINDS.flatMap((kind) => {
  const labels = RELATION_LABELS[kind];
  const choices = [{ value: `${kind}:from`, label: labels.from }];
  if (labels.to !== labels.from) {
    choices.push({ value: `${kind}:to`, label: labels.to });
  }
  return choices;
});

const RELATION_FIELDS = [
  {
    name: 'role',
    label: 'Role',
    input: 'text',
    placeholder: 'e.g. Chief Legal Officer',
  },
  { name: 'start', label: 'Start', input: 'partialDate' },
  { name: 'end', label: 'End', input: 'partialDate' },
  { name: 'amountUsd', label: 'Amount (USD)', input: 'number' },
  { name: 'source', label: 'Source URL', input: 'url' },
];

// One relation as a row, like the page's "related" list: what it is, the other entity, details
function relationRow(relation) {
  // "worked at" once it has an end date
  const verb = relationLabel(relation);
  const other = relation.other.disambiguator
    ? `${relation.other.name} (${relation.other.disambiguator})`
    : relation.other.name;
  const details = [
    relation.role,
    relation.start || relation.end
      ? `${formatPartialDate(relation.start) || '?'} – ${formatPartialDate(relation.end) || 'now'}`
      : null,
    relation.amountUsd != null
      ? `$${relation.amountUsd.toLocaleString()}`
      : null,
  ].filter(Boolean);
  return `<li>
    <span class="relation-verb">${escapeHtml(verb)}</span>
    <a href="/admin/entities/${escapeHtml(relation.other._id)}">${escapeHtml(other)}</a>
    ${details.length ? `<span class="side-hint">${escapeHtml(details.join(' · '))}</span>` : ''}
    <span class="relation-actions"><button type="button" class="link-button" data-edit="${escapeHtml(relation._id)}">edit</button> · <button type="button" class="link-button" data-delete="${escapeHtml(relation._id)}">delete</button></span>
  </li>`;
}

function setupRelations(entity, initialRelations) {
  const section = document.getElementById('relations');
  const list = document.getElementById('relation-list');
  const form = document.getElementById('relation-form');
  const fields = document.getElementById('relation-fields');
  const formTitle = document.getElementById('relation-form-title');
  const cancel = document.getElementById('relation-cancel');
  const error = form.querySelector('.relation-error');
  let relations = initialRelations;
  let editingId = null;

  fields.innerHTML = `
    <div class="entity-field-row">
      <label for="relation-kind">${escapeHtml(entity.name)}…</label>
      <select id="relation-kind">${RELATION_CHOICES.map(
        (choice) =>
          `<option value="${choice.value}">${escapeHtml(choice.label)}</option>`,
      ).join('')}</select>
    </div>
    <div class="entity-field-row">
      <label for="relation-other">entity</label>
      <input id="relation-other" type="text">
    </div>`;
  for (const field of RELATION_FIELDS) {
    fields.appendChild(renderSideRow(field, undefined));
  }
  const otherPicker = createAboutPicker('#relation-other', { maxItems: 1 });

  const renderList = () => {
    list.innerHTML = relations.length
      ? relations.map(relationRow).join('')
      : '<li class="side-hint">No relations yet.</li>';
  };

  const resetForm = () => {
    editingId = null;
    form.reset();
    otherPicker.clear(true);
    formTitle.textContent = 'Add a relation';
    cancel.hidden = true;
    error.hidden = true;
  };

  list.addEventListener('click', async (evt) => {
    const editId = evt.target.dataset?.edit;
    const deleteId = evt.target.dataset?.delete;
    if (editId) {
      const relation = relations.find((r) => r._id === editId);
      editingId = editId;
      document.getElementById('relation-kind').value =
        `${relation.kind}:${relation.direction}`;
      otherPicker.addOption(relation.other);
      otherPicker.setValue(relation.other._id, true);
      for (const field of RELATION_FIELDS) {
        const control = fields.querySelector(`[data-control="${field.name}"]`);
        const value = relation[field.name];
        control.value = value ?? '';
      }
      formTitle.textContent = 'Edit relation';
      cancel.hidden = false;
      form.scrollIntoView({ behavior: 'smooth' });
    } else if (deleteId && window.confirm('Delete this relation?')) {
      await axios.delete(`/dynamic-api/entities/relations/${deleteId}`);
      relations = relations.filter((r) => r._id !== deleteId);
      renderList();
    }
  });

  cancel.addEventListener('click', resetForm);

  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    error.hidden = true;
    const [other] = selectedValues(otherPicker);
    if (!other) {
      error.textContent = 'Choose the other entity.';
      error.hidden = false;
      return;
    }
    const [kind, direction] = document
      .getElementById('relation-kind')
      .value.split(':');
    const body = { entity: entity._id, other, kind, direction };
    for (const field of RELATION_FIELDS) {
      body[field.name] = readControl(
        field,
        fields.querySelector(`[data-control="${field.name}"]`),
      );
    }
    try {
      const { data } = editingId
        ? await axios.put(`/dynamic-api/entities/relations/${editingId}`, body)
        : await axios.post(
            `/dynamic-api/entities/${entity._id}/relations`,
            body,
          );
      relations = data;
      renderList();
      resetForm();
    } catch (err) {
      error.textContent = err.response?.data?.error || err.message;
      error.hidden = false;
    }
  });

  renderList();
  section.hidden = false;
}

// Deleting and merging ---------------------------------------------------------------------------

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// What deleting or merging will touch, from /entities/:id/usage
function usageLines(usage, { merging }) {
  return [
    usage.posts.length
      ? `mentioned in ${plural(usage.posts.length, 'post')}${merging ? '' : ' (the mentions become plain text)'}`
      : null,
    usage.about
      ? `the subject of ${plural(usage.about, 'entry', 'entries')}`
      : null,
    usage.relations
      ? `${plural(usage.relations, 'relation')}${merging ? ' (moved)' : ' (deleted)'}`
      : null,
    usage.outletOf
      ? `the outlet of ${plural(usage.outletOf, 'reading entry', 'reading entries')}`
      : null,
    usage.inPress
      ? `the author of or in ${plural(usage.inPress, 'press entry', 'press entries')}${merging ? '' : ' (removed from them)'}`
      : null,
  ].filter(Boolean);
}

function setupRemoval(entity) {
  const error = document.querySelector('.entity-remove-error');
  const mergeForm = document.getElementById('entity-merge-form');
  let picker;
  const fail = (err) => {
    error.textContent = err.response?.data?.error || err.message;
    error.hidden = false;
  };
  const usage = async () =>
    (await axios.get(`/dynamic-api/entities/${entity._id}/usage`)).data;

  document
    .getElementById('entity-delete')
    .addEventListener('click', async () => {
      error.hidden = true;
      try {
        const lines = usageLines(await usage(), { merging: false });
        const ok = window.confirm(
          `Delete ${entity.name}?${lines.length ? `\n\nIt's ${lines.join(', ')}.` : ''}\n\nThis can't be undone.`,
        );
        if (ok) {
          await axios.delete(`/dynamic-api/entities/${entity._id}`);
          window.location.href = '/admin/entities';
        }
      } catch (err) {
        fail(err);
      }
    });

  document.getElementById('entity-merge').addEventListener('click', () => {
    mergeForm.hidden = false;
    if (!picker) {
      picker = createAboutPicker('#entity-merge-into', { maxItems: 1 });
    }
    picker.focus();
  });
  document
    .getElementById('entity-merge-cancel')
    .addEventListener('click', () => {
      mergeForm.hidden = true;
    });
  mergeForm.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    error.hidden = true;
    const [into] = selectedValues(picker);
    if (!into) {
      fail(new Error('Choose the entity to keep.'));
      return;
    }
    const keepName = picker.options[into]?.name || 'the entity you chose';
    try {
      const lines = usageLines(await usage(), { merging: true });
      const ok = window.confirm(
        `Merge ${entity.name} into ${keepName}?${lines.length ? `\n\n${entity.name} is ${lines.join(', ')}; all of that will be ${keepName}'s.` : ''}\n\n${entity.name} is then deleted. This can't be undone.`,
      );
      if (ok) {
        const { data } = await axios.post(
          `/dynamic-api/entities/${entity._id}/merge`,
          { into },
        );
        window.location.href = `/admin/entities/${data.keep}`;
      }
    } catch (err) {
      fail(err);
    }
  });
}

// Page -----------------------------------------------------------------------------------------

export async function setupEntityForm(pageData) {
  const { type } = pageData;
  let { entity } = pageData;
  const form = document.getElementById('entity-form');
  const containers = {
    head: document.getElementById('entity-head'),
    main: document.getElementById('entity-main-fields'),
    side: document.getElementById('entity-side-fields'),
  };
  const matches = document.querySelector(
    '.entity-editor-main > .entity-matches',
  );
  const error = document.querySelector('.entity-editor-main > .entity-error');
  const status = document.getElementById('entity-status');

  // Without a public page, the editor is labelled and its name greyed out (entity.pug), following
  // the "has a page" checkbox as it's ticked, not only once saved
  const showVisibility = () => {
    const hasPage = document.getElementById(fieldId({ name: 'hasPage' }));
    if (hasPage) {
      document
        .querySelector('.entity-editor')
        .classList.toggle('entity-editor-private', !hasPage.checked);
    }
  };
  containers.side.addEventListener('change', (evt) => {
    if (evt.target.id === fieldId({ name: 'hasPage' })) {
      showVisibility();
    }
  });

  // Attach the submit handler before rendering finishes (the tag list loads asynchronously), so
  // an early click can't fall through to a native form submission.
  let ready = renderFields(containers, type, entity).then(showVisibility);

  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    await ready;
    matches.hidden = true;
    error.hidden = true;
    const fields = collectFields(containers, type);
    try {
      if (!entity) {
        const { data } = await axios.post('/dynamic-api/entities', {
          type,
          ...fields,
        });
        window.location.href = `/admin/entities/${data._id}`;
        return;
      }
      const { data } = await axios.put(
        `/dynamic-api/entities/${entity._id}`,
        fields,
      );
      entity = data.entity;
      document.title = `${entity.name} · Admin`;
      tagPicker?.destroy();
      ready = renderFields(containers, type, entity).then(showVisibility);
      await ready;
      status.textContent = savedAt();
    } catch (err) {
      if (err.response?.status === 409) {
        showMatches(
          matches,
          err.response.data.reason,
          err.response.data.matches,
        );
      } else {
        error.textContent = err.response?.data?.error || err.message;
        error.hidden = false;
      }
    }
  });

  // Fill empty fields from Wikidata, found by the Wikidata ID or else the Wikipedia article. The
  // form is redrawn with the additions; nothing is saved until Save.
  containers.side.addEventListener('click', async (evt) => {
    const button = evt.target.closest('.wikidata-fill');
    if (!button) {
      return;
    }
    await ready;
    const current = collectFields(containers, type);
    const say = (message) => {
      containers.side.querySelector('.wikidata-fill-status').textContent =
        message;
    };
    button.disabled = true;
    say('looking up…');
    try {
      const { data: suggestions } = await axios.get(
        '/dynamic-api/entities/wikidata',
        {
          params: {
            type,
            wikidata: wikidataId(current.ids?.wikidata) || undefined,
            wikipedia: current.ids?.wikipedia,
          },
        },
      );
      const { entity: filled, added } = fillFromWikidata(
        // A pasted link to the entry counts as its ID
        {
          ...current,
          ids: {
            ...current.ids,
            wikidata: wikidataId(current.ids?.wikidata) || undefined,
          },
        },
        suggestions,
      );
      tagPicker?.destroy();
      ready = renderFields(containers, type, {
        ...filled,
        tag: current.tag ? { _id: current.tag } : undefined,
      }).then(showVisibility);
      await ready;
      say(
        added.length
          ? `Added ${added.join(', ')}. Check them, then save.`
          : 'Nothing new on Wikidata.',
      );
    } catch (err) {
      button.disabled = false;
      say(err.response?.data?.error || err.message);
    }
  });

  if (entity) {
    setupRelations(entity, pageData.relations);
    setupRemoval(entity);
  }
  await ready;
}
