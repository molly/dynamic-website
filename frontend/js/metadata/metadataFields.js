import axios from 'axios';
import debounce from 'lodash.debounce';
import { parsePostUrl } from '../../../api/helpers/postUrl.js';
import {
  MENTION_NETWORKS,
  NETWORK_LABELS,
} from '../../../api/helpers/socialMedia.js';
import { suggestSources } from '../../../api/helpers/sources.js';
import { escapeHtml } from '../helpers/escapeHtml.js';
import { fromLocalInput, nowLocalInput, toLocalInput } from './dates.js';

// Side panel fields for a micro post's sources, data link, the post it replies to, and live
// status. Each has setValue(saved) and getValue(), which returns what the save route takes (null
// for an emptied field, so the route removes it).

const isUrl = (text) => /^https?:\/\/\S+$/.test(text);
const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

export class SourcesField {
  /**
   * @param {Object} options
   * @param {() => Promise<Object[]>} options.getBlocks The post's blocks, for suggestions
   * @param {() => void} options.onChange
   */
  constructor({ getBlocks, onChange }) {
    this.getBlocks = getBlocks;
    this.onChange = onChange;
    this.list = document.getElementById('sources-list');
    this.suggestions = document.getElementById('sources-suggestions');
    this.rows = [];
    this.suggested = [];

    document
      .getElementById('sources-add')
      .addEventListener('click', () =>
        this.addRow({ label: '', url: '' }, true),
      );
    document
      .getElementById('sources-suggest')
      .addEventListener('click', () => this.suggest().catch(console.error));
    const changed = debounce(() => this.onChange(), 400);
    this.list.addEventListener('input', changed);
    this.list.addEventListener('click', (evt) => {
      const remove = evt.target.closest('.meta-remove');
      if (remove) {
        remove.closest('.meta-row').remove();
        this.onChange();
      }
    });
    this.suggestions.addEventListener('click', (evt) => {
      const add = evt.target.closest('[data-suggestion]');
      if (add) {
        this.addRow(this.suggested[Number(add.dataset.suggestion)]);
        add.closest('li').remove();
        if (!this.suggestions.querySelector('li')) {
          this.suggestions.innerHTML = '';
        }
        this.onChange();
      }
    });
  }

  addRow({ label, url }, focus = false) {
    const row = document.createElement('li');
    row.className = 'meta-row';
    row.innerHTML = `
      <input type="text" class="source-label" placeholder="label, e.g. complaint (PDF)" aria-label="Source label" value="${escapeHtml(label)}">
      <input type="url" class="source-url" placeholder="https://" aria-label="Source URL" value="${escapeHtml(url)}">
      <button type="button" class="link-button meta-remove" aria-label="Remove source">×</button>`;
    this.list.append(row);
    if (focus) {
      row.querySelector('.source-label').focus();
    }
  }

  async suggest() {
    this.suggested = suggestSources(await this.getBlocks(), this.readRows());
    this.suggestions.innerHTML = this.suggested.length
      ? `<ul>${this.suggested
          .map(
            (s, i) => `<li>
              <span class="suggestion-label">${escapeHtml(s.label)}</span>
              <span class="side-hint">${escapeHtml(hostOf(s.url))}</span>
              <button type="button" class="link-button" data-suggestion="${i}">add</button></li>`,
          )
          .join('')}</ul>`
      : '<p class="side-hint">No document links in the post.</p>';
  }

  readRows() {
    return [...this.list.querySelectorAll('.meta-row')].map((row) => ({
      label: row.querySelector('.source-label').value.trim(),
      url: row.querySelector('.source-url').value.trim(),
    }));
  }

  setValue(sources = []) {
    this.list.innerHTML = '';
    this.suggestions.innerHTML = '';
    sources.forEach((source) => this.addRow(source));
  }

  getValue() {
    return this.readRows()
      .filter((s) => s.url || s.label)
      .map((s, i) => {
        if (!isUrl(s.url)) {
          throw new Error(`Source ${i + 1} needs a URL starting with http.`);
        }
        return { label: s.label || hostOf(s.url), url: s.url };
      });
  }
}

export class DataField {
  constructor({ onChange }) {
    this.label = document.getElementById('data-label');
    this.url = document.getElementById('data-url');
    this.url.addEventListener('input', debounce(onChange, 400));
  }

  setValue(data) {
    this.label.value = data?.label || '';
    this.url.value = data?.url || '';
  }

  getValue() {
    const url = this.url.value.trim();
    const label = this.label.value.trim();
    if (!url) {
      if (label) {
        throw new Error('The data link needs a URL.');
      }
      return null;
    }
    if (!isUrl(url)) {
      throw new Error('The data link needs a URL starting with http.');
    }
    return { label: label || hostOf(url), url };
  }
}

const REPLY_NETWORKS = MENTION_NETWORKS;

export class ReplyField {
  constructor({ onChange }) {
    this.onChange = onChange;
    this.url = document.getElementById('reply-url');
    this.status = document.getElementById('reply-status');
    this.details = document.getElementById('reply-details');
    this.name = document.getElementById('reply-name');
    this.network = document.getElementById('reply-network');
    this.postedAt = document.getElementById('reply-posted');
    this.network.innerHTML = REPLY_NETWORKS.map(
      (n) => `<option value="${n}">${NETWORK_LABELS[n]}</option>`,
    ).join('');

    // Look the post up as soon as a link is pasted or typed.
    this.url.addEventListener(
      'input',
      debounce(() => this.lookUp().catch(console.error), 400),
    );
    document.getElementById('reply-clear').addEventListener('click', () => {
      this.setValue(null);
      this.onChange();
    });
  }

  async lookUp() {
    const url = this.url.value.trim();
    this.details.hidden = !url;
    if (!url) {
      this.status.textContent = '';
      this.onChange();
      return;
    }
    const parsed = parsePostUrl(url);
    if (!parsed) {
      this.status.textContent = isUrl(url)
        ? 'Not a Bluesky, Mastodon or Twitter post; fill in the details by hand.'
        : '';
      this.onChange();
      return;
    }
    this.network.value = parsed.network;
    if (parsed.network === 'twitter') {
      if (!this.name.value) {
        this.name.value = `@${parsed.handle}`;
      }
      this.status.textContent =
        'Twitter posts can’t be looked up; add the date by hand.';
      this.onChange();
      return;
    }
    this.status.textContent = 'Looking up…';
    try {
      const { data } = await axios.get('/dynamic-api/micro/replyInfo', {
        params: { url },
      });
      if (this.url.value.trim() !== url) {
        return; // The link changed while this was loading
      }
      this.name.value = data.name || '';
      this.postedAt.value = toLocalInput(data.postedAt);
      this.status.textContent = `Found ${data.name} (@${data.handle}).`;
    } catch (err) {
      this.status.textContent = err.response?.data?.error || err.message;
    }
    this.onChange();
  }

  setValue(reply) {
    this.url.value = reply?.url || '';
    this.name.value = reply?.name || '';
    this.network.value = reply?.network || 'bluesky';
    this.postedAt.value = toLocalInput(reply?.postedAt);
    this.details.hidden = !reply?.url;
    this.status.textContent = '';
  }

  getValue() {
    const url = this.url.value.trim();
    if (!url) {
      return null;
    }
    if (!isUrl(url)) {
      throw new Error('“In reply to” needs a URL starting with http.');
    }
    return {
      url,
      name: this.name.value.trim(),
      network: this.network.value,
      postedAt: fromLocalInput(this.postedAt.value),
    };
  }
}

export class LiveField {
  /**
   * @param {Object} options
   * @param {(isLive: boolean) => void} options.onToggle
   */
  constructor({ onToggle }) {
    this.toggle = document.getElementById('live-toggle');
    this.details = document.getElementById('live-details');
    this.status = document.getElementById('live-status');
    this.startedAt = document.getElementById('live-started');
    this.onToggle = onToggle;
    this.toggle.addEventListener('change', () => {
      this.details.hidden = !this.toggle.checked;
      if (this.toggle.checked && !this.startedAt.value) {
        this.startedAt.value = nowLocalInput();
      }
      this.onToggle(this.toggle.checked);
    });
  }

  get isLive() {
    return this.toggle.checked;
  }

  setValue(live) {
    this.toggle.checked = Boolean(live?.status);
    this.status.value = live?.status || 'updating';
    this.startedAt.value = toLocalInput(live?.startedAt);
    this.details.hidden = !this.toggle.checked;
    this.onToggle(this.toggle.checked);
  }

  getValue() {
    if (!this.toggle.checked) {
      return null;
    }
    return {
      status: this.status.value,
      startedAt: fromLocalInput(this.startedAt.value),
    };
  }
}
