import { escapeHtml } from '../helpers/escapeHtml.js';

// Block tune for images and galleries: where the image came from. Saved with the block as
// block.tunes.imageSource = { sourceName, sourceUrl, screenshot, capturedAt }.

const ICON =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>';

function summary({ sourceName, sourceUrl, screenshot, capturedAt }) {
  let host = '';
  try {
    host = sourceUrl ? new URL(sourceUrl).hostname.replace(/^www\./, '') : '';
  } catch {
    host = '';
  }
  return [
    screenshot ? 'screenshot' : null,
    sourceName || host || null,
    capturedAt ? `captured ${capturedAt}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export default class ImageSourceTune {
  static get isTune() {
    return true;
  }

  constructor({ data, readOnly }) {
    this.readOnly = readOnly;
    this.data = {
      sourceName: '',
      sourceUrl: '',
      screenshot: false,
      capturedAt: '',
      ...data,
    };
    this.open = false;
  }

  render() {
    return {
      icon: ICON,
      label: 'Source details',
      closeOnActivate: true,
      onActivate: () => {
        this.open = !this.open;
        this.draw();
      },
    };
  }

  wrap(blockContent) {
    this.wrapper = document.createElement('div');
    this.wrapper.appendChild(blockContent);
    this.panel = document.createElement('div');
    this.panel.className = 'image-source';
    this.panel.addEventListener('keydown', (evt) => evt.stopPropagation());
    this.panel.addEventListener('paste', (evt) => evt.stopPropagation());
    this.panel.addEventListener('input', () => this.read());
    this.panel.addEventListener('change', () => this.read());
    this.wrapper.appendChild(this.panel);
    this.draw();
    return this.wrapper;
  }

  read() {
    const value = (name) => this.panel.querySelector(`[name=${name}]`);
    this.data = {
      sourceName: value('sourceName').value.trim(),
      sourceUrl: value('sourceUrl').value.trim(),
      screenshot: value('screenshot').checked,
      capturedAt: value('capturedAt').value,
    };
  }

  draw() {
    if (!this.panel) {
      return;
    }
    const line = summary(this.data);
    if (!this.open || this.readOnly) {
      this.panel.innerHTML = line
        ? `<p class="image-source-summary">${escapeHtml(line)}</p>`
        : '';
      return;
    }
    this.panel.innerHTML = `
      <div class="image-source-fields">
        <input name="sourceName" type="text" placeholder="Source (e.g. Tech Influence Watch)" value="${escapeHtml(this.data.sourceName)}">
        <input name="sourceUrl" type="url" placeholder="Source URL" value="${escapeHtml(this.data.sourceUrl)}">
        <label><input name="screenshot" type="checkbox"${this.data.screenshot ? ' checked' : ''}> screenshot</label>
        <label>captured <input name="capturedAt" type="date" value="${escapeHtml(this.data.capturedAt)}"></label>
      </div>`;
  }

  save() {
    return this.data;
  }
}
