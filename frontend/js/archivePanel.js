import axios from 'axios';
import { DateTime } from 'luxon';
import { escapeHtml } from './helpers/escapeHtml.js';

// The "Links" checklist in the editor's side panel: every link in the post with its archive
// status. Unarchived (or failed) links can be ticked; ticked links are archived when the post is
// saved. Statuses refresh while any link is queued.

const POLL_MS = 5000;

function shortUrl(url) {
  try {
    const { hostname, pathname } = new URL(url);
    const short = `${hostname.replace(/^www\./, '')}${pathname === '/' ? '' : pathname}`;
    return short.length > 42 ? `${short.slice(0, 41)}…` : short;
  } catch {
    return url;
  }
}

const needsArchiving = ({ status }) => status === 'none' || status === 'failed';

export class ArchivePanel {
  constructor() {
    this.list = document.getElementById('archive-list');
    this.archiveAll = document.getElementById('archive-all');
    this.statuses = [];
    this.checked = new Set();
    this.blocks = [];
    this.urls = [];

    this.list.addEventListener('change', (evt) => {
      const url = evt.target.dataset?.url;
      if (url) {
        if (evt.target.checked) {
          this.checked.add(url);
        } else {
          this.checked.delete(url);
        }
      }
    });
    this.archiveAll.addEventListener('click', () => {
      for (const link of this.statuses.filter(needsArchiving)) {
        this.checked.add(link.url);
      }
      this.render();
    });
  }

  /**
   * Re-read the post's links and their status.
   * @param {Object[]} blocks The post's EditorJS blocks as currently written, with its updates'
   * @param {string[]} urls Other links on the post: sources, data, the post it replies to
   */
  async refresh(blocks = this.blocks, urls = this.urls) {
    this.blocks = blocks;
    this.urls = urls;
    const { data } = await axios.post('/dynamic-api/archive/links', {
      blocks,
      urls,
    });
    this.statuses = data;
    // Forget ticks on links that are no longer in the post, or no longer need archiving.
    const tickable = new Set(data.filter(needsArchiving).map((l) => l.url));
    this.checked = new Set(
      [...this.checked].filter((url) => tickable.has(url)),
    );
    this.render();
    this.schedulePoll();
  }

  render() {
    if (!this.statuses.length) {
      this.list.innerHTML = '<li class="side-hint">No links in this post.</li>';
      this.archiveAll.hidden = true;
      return;
    }
    this.list.innerHTML = this.statuses
      .map((link) => {
        const box = needsArchiving(link)
          ? `<input type="checkbox" data-url="${escapeHtml(link.url)}" aria-label="Archive ${escapeHtml(link.url)}"${this.checked.has(link.url) ? ' checked' : ''}>`
          : '<span class="archive-done" aria-hidden="true">✓</span>';
        let status = '';
        if (link.status === 'ok') {
          const date = link.archivedAt
            ? DateTime.fromISO(link.archivedAt).toFormat('LLL d')
            : '';
          status = `<a href="${escapeHtml(link.archiveUrl)}" target="_blank" rel="noopener">archived ${date}</a>`;
        } else if (link.status === 'queued') {
          status = 'queued…';
        } else if (link.status === 'failed') {
          status = `<span class="over-limit" title="${escapeHtml(link.error || '')}">failed</span>`;
        }
        return `<li class="archive-row">${box}
          <a class="archive-url" href="${escapeHtml(link.url)}" target="_blank" rel="noopener" title="${escapeHtml(link.url)}">${escapeHtml(shortUrl(link.url))}</a>
          <span class="archive-status">${status}</span></li>`;
      })
      .join('');
    this.archiveAll.hidden = !this.statuses.some(needsArchiving);
  }

  schedulePoll() {
    clearTimeout(this.pollTimeout);
    if (this.statuses.some((link) => link.status === 'queued')) {
      this.pollTimeout = setTimeout(
        () => this.refresh().catch(console.error),
        POLL_MS,
      );
    }
  }

  /**
   * Queue the ticked links for archiving. Called after the post is saved.
   */
  async queueChecked() {
    const urls = [...this.checked];
    if (!urls.length) {
      return;
    }
    await axios.post('/dynamic-api/archive', { urls });
    this.checked.clear();
    await this.refresh();
  }
}
