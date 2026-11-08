import { formatDuration } from '../../../api/helpers/blocks.js';
import { escapeHtml } from '../helpers/escapeHtml.js';
import { chooseLinkedFile, uploadFile as upload } from '../helpers/upload.js';

// Block for your own copies of video and audio (talks, podcast appearances): uploaded to the
// bucket and played with the browser's own player, never embedded from another site.
// Data: { url, kind: 'video' | 'audio', contentType, duration (seconds), poster?, caption }

export default class MediaTool {
  static get toolbox() {
    return {
      title: 'Video or audio',
      icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 4 20 12 6 20 6 4"/></svg>',
    };
  }

  static get isReadOnlySupported() {
    return true;
  }

  constructor({ data, api, readOnly }) {
    this.api = api;
    this.readOnly = readOnly;
    this.data = { caption: '', ...data };
    this.wrapper = null;
  }

  render() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'media-tool';
    this.draw();
    return this.wrapper;
  }

  draw() {
    const { url, kind, poster, caption, duration } = this.data;
    if (!url) {
      this.wrapper.innerHTML = `
        <label class="media-upload">
          <span>Upload a video or audio file</span>
          <input type="file" accept="video/*,audio/*">
        </label>
        <p class="media-status" hidden></p>`;
      this.wrapper
        .querySelector('input')
        .addEventListener('change', (evt) => this.onFile(evt.target.files[0]));
      return;
    }
    const player =
      kind === 'audio'
        ? `<audio controls preload="metadata" src="${escapeHtml(url)}"></audio>`
        : `<video controls preload="metadata" src="${escapeHtml(url)}"${poster ? ` poster="${escapeHtml(poster)}"` : ''}></video>`;
    this.wrapper.innerHTML = `
      ${player}
      <div class="media-meta">
        <span class="media-duration">${formatDuration(duration)}</span>
        ${kind === 'video' ? `<label class="link-button">${poster ? 'change poster' : 'add poster image'}<input type="file" accept="image/*" class="poster-input" hidden></label> or <button type="button" class="link-button poster-url">use a link</button>` : ''}
      </div>
      <div class="media-caption" contenteditable="${!this.readOnly}" data-placeholder="Caption">${caption || ''}</div>`;
    const media = this.wrapper.querySelector('video, audio');
    media.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(media.duration)) {
        this.data.duration = media.duration;
        this.wrapper.querySelector('.media-duration').textContent =
          formatDuration(media.duration);
      }
    });
    this.wrapper
      .querySelector('.poster-input')
      ?.addEventListener('change', (evt) => this.onPoster(evt.target.files[0]));
    this.wrapper
      .querySelector('.poster-url')
      ?.addEventListener('click', () => this.posterFromUrl());
  }

  async posterFromUrl() {
    try {
      const file = await chooseLinkedFile({ label: 'poster image' });
      if (file) {
        this.data.poster = file.url;
        this.draw();
      }
    } catch (err) {
      window.alert(`Couldn't use that poster: ${err.message}`);
    }
  }

  async onFile(file) {
    if (!file) {
      return;
    }
    const status = this.wrapper.querySelector('.media-status');
    status.hidden = false;
    status.textContent = `Uploading ${file.name}…`;
    try {
      const uploaded = await upload(file);
      const contentType = uploaded.contentType || file.type;
      this.data = {
        ...this.data,
        url: uploaded.url,
        contentType,
        kind: contentType.startsWith('audio/') ? 'audio' : 'video',
      };
      this.draw();
    } catch (err) {
      status.textContent = `Upload failed: ${err.message}`;
    }
  }

  async onPoster(file) {
    if (!file) {
      return;
    }
    try {
      this.data.poster = (await upload(file)).url;
      this.draw();
    } catch (err) {
      window.alert(`Poster upload failed: ${err.message}`);
    }
  }

  save() {
    const caption = this.wrapper.querySelector('.media-caption');
    return {
      ...this.data,
      caption: caption ? caption.innerHTML : this.data.caption,
    };
  }

  validate(data) {
    return Boolean(data.url);
  }
}
