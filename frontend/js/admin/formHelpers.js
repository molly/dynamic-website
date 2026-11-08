import {
  PARTIAL_DATE_PATTERN,
  PARTIAL_DATE_PLACEHOLDER,
} from '../../../api/helpers/partialDate.js';
import { escapeHtml } from '../helpers/escapeHtml.js';

export { escapeHtml };

/**
 * Value at a dotted path ("status.value").
 * @param {Object} obj
 * @param {string} path
 */
export function getPath(obj, path) {
  return path.split('.').reduce((value, key) => value?.[key], obj);
}

/**
 * Set a value at a dotted path, creating objects along the way.
 * @param {Object} obj
 * @param {string} path
 * @param {*} value
 */
export function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const parent = keys.reduce((target, key) => {
    if (target[key] === undefined) {
      target[key] = {};
    }
    return target[key];
  }, obj);
  parent[last] = value;
}

/**
 * A form control for a simple field (text, textarea, url, date, partialDate, number, checkbox,
 * select). partialDate is a year, month or day, typed: "2019", "2019-03" or "2019-03-05".
 * @param {{input: string, options?: string[], placeholder?: string}} field
 * @param {*} value
 * @returns {HTMLElement}
 */
export function renderControl(field, value) {
  if (field.input === 'textarea') {
    const textarea = document.createElement('textarea');
    textarea.rows = 3;
    textarea.value = value ?? '';
    return textarea;
  }
  if (field.input === 'select') {
    const select = document.createElement('select');
    select.innerHTML = `<option value="">—</option>${field.options
      .map(
        (option) =>
          `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`,
      )
      .join('')}`;
    select.value = value ?? '';
    return select;
  }
  const input = document.createElement('input');
  if (field.input === 'partialDate') {
    input.type = 'text';
    input.inputMode = 'numeric';
    input.pattern = PARTIAL_DATE_PATTERN;
    input.placeholder = PARTIAL_DATE_PLACEHOLDER;
    input.value = value ?? '';
    return input;
  }
  input.type = field.input === 'checkbox' ? 'checkbox' : field.input;
  if (field.input === 'checkbox') {
    input.checked = Boolean(value);
  } else if (field.input === 'date') {
    input.value = value ? String(value).slice(0, 10) : '';
  } else {
    input.value = value ?? '';
  }
  if (field.input === 'number') {
    input.step = 'any';
  }
  if (field.placeholder) {
    input.placeholder = field.placeholder;
  }
  return input;
}

/**
 * Read a control rendered by renderControl. Empty values come back undefined.
 * @param {{input: string}} field
 * @param {HTMLElement} control
 */
export function readControl(field, control) {
  if (field.input === 'checkbox') {
    return control.checked;
  }
  const value = control.value.trim();
  if (value === '') {
    return undefined;
  }
  return field.input === 'number' ? Number(value) : value;
}

/**
 * Show a short status message that fades after a few seconds.
 * @param {HTMLElement} element
 * @param {string} message
 */
export function showStatus(element, message) {
  element.textContent = message;
  element.hidden = false;
  clearTimeout(element._timeout);
  element._timeout = setTimeout(() => {
    element.hidden = true;
  }, 3000);
}
