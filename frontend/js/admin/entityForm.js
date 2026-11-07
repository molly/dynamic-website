import axios from 'axios';
import TomSelect from 'tom-select';
import { fieldsFor } from '../../../api/helpers/entityFields.js';
import {
  RELATION_KINDS,
  RELATION_LABELS,
} from '../../../api/helpers/entityTypes.js';
import { createAboutPicker, selectedValues } from '../helpers/pickers.js';
import {
  escapeHtml,
  getPath,
  readControl,
  renderControl,
  setPath,
  showStatus,
} from './formHelpers.js';

// Entity admin form, rendered from the field lists in api/helpers/entityFields.js.

let tagPicker;

// Fields ---------------------------------------------------------------------------------------

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

function renderStringRow(value = '') {
  const row = document.createElement('div');
  row.className = 'list-row';
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.dataset.sub = 'value';
  row.append(input, removeButton());
  return row;
}

function removeButton() {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'remove-row';
  button.setAttribute('aria-label', 'Remove');
  button.textContent = '×';
  return button;
}

function renderField(field, value) {
  const wrapper = document.createElement('div');
  wrapper.className = 'input-group';
  wrapper.dataset.field = field.name;
  const id = `field-${field.name.replace(/\./g, '-')}`;

  if (field.input === 'list' || field.input === 'strings') {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'list-field';
    fieldset.dataset.field = field.name;
    fieldset.innerHTML = `<legend>${escapeHtml(field.label)}</legend><div class="list-rows"></div>`;
    const rows = fieldset.querySelector('.list-rows');
    const newRow = (item) =>
      field.input === 'list'
        ? renderListRow(field, item)
        : renderStringRow(item);
    for (const item of value || []) {
      rows.appendChild(newRow(item));
    }
    const add = document.createElement('button');
    add.type = 'button';
    add.textContent = `Add ${field.label.toLowerCase()}`;
    add.addEventListener('click', () => rows.appendChild(newRow()));
    rows.addEventListener('click', (evt) => {
      if (evt.target.classList.contains('remove-row')) {
        evt.target.closest('.list-row').remove();
      }
    });
    fieldset.appendChild(add);
    if (field.help) {
      fieldset.insertAdjacentHTML(
        'beforeend',
        `<p class="field-help">${escapeHtml(field.help)}</p>`,
      );
    }
    return fieldset;
  }

  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = field.label;
  const control =
    field.input === 'tag'
      ? Object.assign(document.createElement('input'), { type: 'text' })
      : renderControl(field, value);
  control.id = id;
  control.dataset.control = field.name;
  wrapper.append(label, control);
  if (field.help) {
    wrapper.insertAdjacentHTML(
      'beforeend',
      `<p class="field-help">${escapeHtml(field.help)}</p>`,
    );
  }
  return wrapper;
}

async function renderFields(container, type, entity) {
  container.innerHTML = '';
  for (const field of fieldsFor(type)) {
    let value = entity ? getPath(entity, field.name) : undefined;
    if (field.name === 'hasPage' && value === undefined) {
      value = type !== 'person'; // Same default as the model: people are mention-only
    }
    container.appendChild(renderField(field, value));
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
function collectFields(container, type) {
  const data = {};
  for (const field of fieldsFor(type)) {
    let value;
    if (field.input === 'tag') {
      value = tagPicker.getValue() || undefined;
    } else if (field.input === 'strings') {
      value = [
        ...container.querySelectorAll(
          `fieldset[data-field="${field.name}"] .list-row input`,
        ),
      ]
        .map((input) => input.value.trim())
        .filter(Boolean);
    } else if (field.input === 'list') {
      value = [
        ...container.querySelectorAll(
          `fieldset[data-field="${field.name}"] .list-row`,
        ),
      ]
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
      value = readControl(
        field,
        container.querySelector(`[data-control="${field.name}"]`),
      );
    }
    if (value !== undefined) {
      setPath(data, field.name, value);
    }
  }
  return data;
}

function showMatches(form, reason, matches) {
  const box = form.querySelector('.entity-matches');
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
  { name: 'start', label: 'Start', input: 'date' },
  { name: 'end', label: 'End', input: 'date' },
  { name: 'amountUsd', label: 'Amount (USD)', input: 'number' },
  { name: 'source', label: 'Source URL', input: 'url' },
];

const formatDate = (date) => (date ? date.slice(0, 10) : '');

function relationLabel(relation) {
  const labels = RELATION_LABELS[relation.kind];
  const verb = labels ? labels[relation.direction] : relation.kind;
  const other = relation.other.disambiguator
    ? `${relation.other.name} (${relation.other.disambiguator})`
    : relation.other.name;
  const details = [
    relation.role,
    relation.start || relation.end
      ? `${formatDate(relation.start) || '?'} – ${formatDate(relation.end) || 'now'}`
      : null,
    relation.amountUsd != null
      ? `$${relation.amountUsd.toLocaleString()}`
      : null,
  ].filter(Boolean);
  return `${escapeHtml(verb)} <a href="/admin/entities/${escapeHtml(relation.other._id)}">${escapeHtml(other)}</a>${details.length ? ` <span class="picker-meta">${escapeHtml(details.join(' · '))}</span>` : ''}`;
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
    <div class="input-group">
      <label for="relation-kind">${escapeHtml(entity.name)}…</label>
      <select id="relation-kind">${RELATION_CHOICES.map(
        (choice) =>
          `<option value="${choice.value}">${escapeHtml(choice.label)}</option>`,
      ).join('')}</select>
    </div>
    <div class="input-group">
      <label for="relation-other">Entity</label>
      <input id="relation-other" type="text">
    </div>`;
  for (const field of RELATION_FIELDS) {
    fields.appendChild(renderField(field, undefined));
  }
  const otherPicker = createAboutPicker('#relation-other', { maxItems: 1 });

  const renderList = () => {
    list.innerHTML = relations.length
      ? relations
          .map(
            (relation) =>
              `<li>${relationLabel(relation)} <button type="button" data-edit="${escapeHtml(relation._id)}">Edit</button> <button type="button" data-delete="${escapeHtml(relation._id)}">Delete</button></li>`,
          )
          .join('')
      : '<li>No relations yet.</li>';
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
        control.value =
          field.input === 'date' ? formatDate(value) : value ?? '';
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

// Page -----------------------------------------------------------------------------------------

export async function setupEntityForm(pageData) {
  const { type } = pageData;
  let { entity } = pageData;
  const form = document.getElementById('entity-form');
  const container = document.getElementById('entity-fields');
  const matches = form.querySelector('.entity-matches');
  const error = form.querySelector('.entity-error');
  const status = form.querySelector('.admin-status');

  // Attach the submit handler before rendering finishes (the tag list loads asynchronously), so
  // an early click can't fall through to a native form submission.
  let ready = renderFields(container, type, entity);

  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    await ready;
    matches.hidden = true;
    error.hidden = true;
    const fields = collectFields(container, type);
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
      document.getElementById('entity-title').textContent = entity.name;
      ready = renderFields(container, type, entity);
      await ready;
      showStatus(status, 'Saved.');
    } catch (err) {
      if (err.response?.status === 409) {
        showMatches(form, err.response.data.reason, err.response.data.matches);
      } else {
        error.textContent = err.response?.data?.error || err.message;
        error.hidden = false;
      }
    }
  });

  if (entity) {
    setupRelations(entity, pageData.relations);
  }
  await ready;
}
