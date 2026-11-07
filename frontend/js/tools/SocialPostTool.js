import axios from 'axios';
import { cleanHtml } from '../../../api/helpers/html.js';
import { parsePostUrl } from '../../../api/helpers/postUrl.js';
import { NETWORK_LABELS } from '../../../api/helpers/socialMedia.js';
import { escapeHtml } from '../helpers/escapeHtml.js';
import { uploadFile } from '../helpers/upload.js';
import { fromLocalInput, toLocalInput } from '../metadata/dates.js';
import { isolateKeys } from './DocumentTool.js';

// "Social post" block: a card for a Bluesky, Mastodon or Twitter post, or a thread of them. Paste a
// Bluesky or Mastodon link and the post is fetched, with its images and video copied to the
// bucket, so the card survives the original being deleted. Twitter posts are entered by hand.
// Data: { posts: [post], screenshot } (post as in backend/helpers/socialFetch.js)

const blankPost = (network = 'twitter', fields = {}) => ({
  network,
  authorName: '',
  handle: '',
  profileUrl: '',
  originalUrl: '',
  postedAt: null,
  textHtml: '',
  media: [],
  linkCard: null,
  quoted: null,
  ...fields,
});

function mediaPreview(item) {
  if (!item.saved || !item.src) {
    return `<span class="sp-missing">${item.type === 'video' ? 'video' : 'image'} not saved</span>`;
  }
  return item.type === 'video'
    ? `<video src="${escapeHtml(item.src)}"${item.poster ? ` poster="${escapeHtml(item.poster)}"` : ''} preload="metadata" muted></video>`
    : `<img src="${escapeHtml(item.src)}" alt="">`;
}

export default class SocialPostTool {
  static get toolbox() {
    return {
      title: 'Social post',
      icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h6M7 13h10"/></svg>',
    };
  }

  static get isReadOnlySupported() {
    return true;
  }

  constructor({ data, readOnly }) {
    this.readOnly = readOnly;
    this.data = { posts: [], screenshot: null, ...data };
    this.adding = false; // Showing the "add a post" box under an existing card
  }

  render() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'social-post-tool';
    isolateKeys(this.wrapper);
    this.wrapper.addEventListener('click', (evt) => this.onClick(evt));
    this.wrapper.addEventListener('change', (evt) => this.onFile(evt));
    this.wrapper.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter' && evt.target.classList.contains('sp-url')) {
        evt.preventDefault();
        this.wrapper.querySelector('.sp-fetch').click();
      }
    });
    this.draw();
    return this.wrapper;
  }

  // Keep what's been typed before redrawing.
  redraw() {
    this.data = this.save();
    this.draw();
  }

  draw() {
    const { posts } = this.data;
    const adder = `
      <div class="sp-add">
        <input type="url" class="sp-url" placeholder="Paste a Bluesky or Mastodon post link" aria-label="Post link">
        <button type="button" class="sp-fetch">fetch</button>
        <span class="side-hint">or <button type="button" class="link-button sp-manual">enter a Twitter post by hand</button></span>
        <p class="sp-status" hidden></p>
      </div>`;
    if (!posts.length) {
      this.wrapper.innerHTML = this.readOnly ? '' : adder;
      return;
    }
    const network = NETWORK_LABELS[posts[0].network] || '';
    this.wrapper.innerHTML = `
      <div class="sp-card">
        <p class="sp-card-head"><span>${posts.length > 1 ? `Thread · ${posts.length} posts` : 'Post'}</span><span class="sp-network">${escapeHtml(network)}</span></p>
        ${posts.map((post, i) => this.postHtml(post, i)).join('')}
        <p class="sp-card-foot">
          ${this.readOnly ? '' : '<button type="button" class="link-button sp-add-post">+ add a post to the thread</button>'}
          <span class="sp-screenshot">${
            this.data.screenshot
              ? `<a href="${escapeHtml(this.data.screenshot)}" target="_blank" rel="noopener">screenshot</a>${this.readOnly ? '' : ' <button type="button" class="link-button sp-remove-screenshot">remove</button>'}`
              : this.readOnly
                ? ''
                : '<label class="link-button">add screenshot<input type="file" accept="image/*" class="sp-screenshot-input" hidden></label>'
          }</span>
        </p>
      </div>
      ${this.adding ? adder : ''}`;
  }

  postHtml(post, index) {
    const ro = this.readOnly ? ' disabled' : '';
    const field = (name, value, placeholder, type = 'text') =>
      `<input type="${type}" data-field="${name}" placeholder="${placeholder}" aria-label="${placeholder}" value="${escapeHtml(value ?? '')}"${ro}>`;
    const isManual = post.network === 'twitter';
    const media = post.media
      .map(
        (item, m) => `
        <div class="sp-media-item">
          ${mediaPreview(item)}
          <input type="text" data-alt="${m}" placeholder="alt text" aria-label="Alt text" value="${escapeHtml(item.alt || '')}"${ro}>
          ${this.readOnly ? '' : `<button type="button" class="link-button sp-remove-media" data-media="${m}" aria-label="Remove">×</button>`}
        </div>`,
      )
      .join('');
    const card = post.linkCard?.url
      ? `<p class="sp-link-card"><span>${escapeHtml(post.linkCard.domain || '')}</span> ${escapeHtml(post.linkCard.title || post.linkCard.url)} ${this.readOnly ? '' : '<button type="button" class="link-button sp-remove-card" aria-label="Remove link card">×</button>'}</p>`
      : '';
    const quoted = post.quoted
      ? `<div class="sp-quoted"><strong>${escapeHtml(post.quoted.authorName)}</strong> @${escapeHtml(post.quoted.handle)} ${this.readOnly ? '' : '<button type="button" class="link-button sp-remove-quoted" aria-label="Remove quoted post">×</button>'}<div>${cleanHtml(post.quoted.textHtml)}</div></div>`
      : '';
    return `
      <div class="sp-post" data-index="${index}">
        <div class="sp-head">
          ${field('authorName', post.authorName, 'Name')}
          <span class="sp-at">@</span>${field('handle', post.handle, 'handle')}
          ${field('postedAt', toLocalInput(post.postedAt), 'Posted', 'datetime-local')}
          ${this.readOnly ? '' : `<button type="button" class="link-button sp-remove-post" aria-label="Remove post">remove</button>`}
        </div>
        <div class="sp-text" contenteditable="${!this.readOnly}" data-placeholder="Post text">${cleanHtml(post.textHtml)}</div>
        ${media ? `<div class="sp-media">${media}</div>` : ''}
        ${isManual && !this.readOnly ? '<label class="link-button sp-upload">+ image or video<input type="file" accept="image/*,video/*" class="sp-media-input" hidden></label>' : ''}
        ${card}${quoted}
        <div class="sp-meta">
          ${field('originalUrl', post.originalUrl, 'Link to the post', 'url')}
        </div>
      </div>`;
  }

  async fetchPost(url) {
    const status = this.wrapper.querySelector('.sp-status');
    const parsed = parsePostUrl(url);
    if (parsed?.network === 'twitter') {
      // No public API: start a card from what the link says.
      this.addPost(
        blankPost('twitter', {
          handle: parsed.handle,
          originalUrl: url,
          profileUrl: `https://twitter.com/${parsed.handle}`,
        }),
      );
      return;
    }
    status.hidden = false;
    status.textContent = 'Fetching the post and saving its media…';
    try {
      const { data } = await axios.post('/dynamic-api/micro/socialPost', {
        url,
      });
      this.addPost(data);
    } catch (err) {
      status.textContent = err.response?.data?.error || err.message;
    }
  }

  addPost(post) {
    this.data = this.save();
    this.data.posts.push(post);
    this.adding = false;
    this.draw();
  }

  postAt(target) {
    const el = target.closest('.sp-post');
    return el ? this.data.posts[Number(el.dataset.index)] : null;
  }

  onClick(evt) {
    const button = evt.target.closest('button');
    if (!button) {
      return;
    }
    if (button.classList.contains('sp-fetch')) {
      const url = this.wrapper.querySelector('.sp-url').value.trim();
      if (url) {
        this.fetchPost(url);
      }
      return;
    }
    if (button.classList.contains('sp-manual')) {
      this.addPost(blankPost('twitter'));
      return;
    }
    if (button.classList.contains('sp-add-post')) {
      this.adding = true;
      this.redraw();
      this.wrapper.querySelector('.sp-url').focus();
      return;
    }
    if (button.classList.contains('sp-remove-screenshot')) {
      this.data = this.save();
      this.data.screenshot = null;
      this.draw();
      return;
    }
    this.data = this.save();
    const post = this.postAt(button);
    if (!post) {
      return;
    }
    if (button.classList.contains('sp-remove-post')) {
      this.data.posts.splice(this.data.posts.indexOf(post), 1);
    } else if (button.classList.contains('sp-remove-media')) {
      post.media.splice(Number(button.dataset.media), 1);
    } else if (button.classList.contains('sp-remove-card')) {
      post.linkCard = null;
    } else if (button.classList.contains('sp-remove-quoted')) {
      post.quoted = null;
    }
    this.draw();
  }

  async onFile(evt) {
    const file = evt.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const uploaded = await uploadFile(file);
      this.data = this.save();
      if (evt.target.classList.contains('sp-screenshot-input')) {
        this.data.screenshot = uploaded.url;
      } else {
        const post = this.postAt(evt.target);
        const type = (uploaded.contentType || file.type).startsWith('video/')
          ? 'video'
          : 'image';
        post.media.push({ type, src: uploaded.url, alt: '', saved: true });
      }
      this.draw();
    } catch (err) {
      window.alert(`Upload failed: ${err.message}`);
    }
  }

  save() {
    if (!this.wrapper) {
      return this.data;
    }
    const posts = this.data.posts.map((post, i) => {
      const el = this.wrapper.querySelector(`.sp-post[data-index="${i}"]`);
      if (!el) {
        return post;
      }
      const updated = {
        ...post,
        media: post.media.map((item, m) => ({
          ...item,
          alt: el.querySelector(`[data-alt="${m}"]`)?.value.trim() ?? item.alt,
        })),
        textHtml: cleanHtml(el.querySelector('.sp-text').innerHTML),
      };
      for (const input of el.querySelectorAll('[data-field]')) {
        const key = input.dataset.field;
        const value = input.value.trim();
        if (key === 'postedAt') {
          updated.postedAt = fromLocalInput(value);
        } else {
          updated[key] = key === 'handle' ? value.replace(/^@/, '') : value;
        }
      }
      if (updated.network === 'twitter') {
        updated.profileUrl = updated.handle
          ? `https://twitter.com/${updated.handle}`
          : '';
      }
      return updated;
    });
    return { ...this.data, posts };
  }

  validate(data) {
    return data.posts.length > 0;
  }
}
