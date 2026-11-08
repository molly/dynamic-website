import axios from 'axios';
import { cleanHtml } from '../../../api/helpers/html.js';
import {
  parsePostUrl,
  twitterProfileUrl,
} from '../../../api/helpers/postUrl.js';
import { NETWORK_LABELS } from '../../../api/helpers/socialMedia.js';
import { escapeHtml } from '../helpers/escapeHtml.js';
import { chooseLinkedFile, uploadFile } from '../helpers/upload.js';
import { X_HELPER_UNREACHABLE, X_HELPER_URL } from '../helpers/xHelper.js';
import { fromLocalInput, toLocalInput } from '../metadata/dates.js';
import { isolateKeys } from './DocumentTool.js';

// "Social post" block: a card for a Bluesky, Mastodon or Twitter post, or a thread of them. Paste a
// link and the post is fetched, with its images and video copied to the bucket, so the card
// survives the original being deleted. Twitter posts are fetched by the local X helper (Twitter has
// no free API), and can still be entered by hand when it isn't running.
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
        <input type="url" class="sp-url" placeholder="Paste a Bluesky, Mastodon or Twitter post link" aria-label="Post link">
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
                : '<label class="link-button">add screenshot<input type="file" accept="image/*" class="sp-screenshot-input" hidden></label> or <button type="button" class="link-button sp-screenshot-url">use a link</button>'
          }</span>
        </p>
      </div>
      ${this.adding ? adder : ''}`;
  }

  postHtml(post, index) {
    const ro = this.readOnly ? ' disabled' : '';
    const field = (name, value, placeholder, type = 'text') =>
      `<input type="${type}" data-field="${name}" placeholder="${placeholder}" aria-label="${placeholder}" value="${escapeHtml(value ?? '')}"${type === 'datetime-local' ? ' step="60"' : ''}${ro}>`;
    const isManual = post.network === 'twitter';
    const media = post.media
      .map(
        (item, m) => `
        <div class="sp-media-item">
          ${mediaPreview(item)}
          <textarea data-alt="${m}" rows="2" placeholder="alt text" aria-label="Alt text"${ro}>${escapeHtml(item.alt || '')}</textarea>
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
        ${isManual && !this.readOnly ? '<label class="link-button sp-upload">+ image or video<input type="file" accept="image/*,video/*" class="sp-media-input" hidden></label> or <button type="button" class="link-button sp-media-url">use a link</button>' : ''}
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
      await this.fetchTweet(url);
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

  /**
   * Fetch a Twitter post with the local X helper, then have the server check it and copy its
   * media. If it replies to other posts, offer to add those too.
   * @param {string} url
   */
  async fetchTweet(url) {
    const status = this.wrapper.querySelector('.sp-status');
    status.hidden = false;
    status.textContent = 'Fetching the post with the X helper…';
    let posts;
    try {
      ({ posts } = (await axios.post(`${X_HELPER_URL}/fetch`, { url })).data);
    } catch (err) {
      status.textContent = err.response
        ? err.response.data?.error || err.message
        : `${X_HELPER_UNREACHABLE} Or enter the post by hand.`;
      return;
    }

    // Skip posts already on the card (e.g. adding a later reply to a thread)
    const onCard = new Set(
      this.save().posts.map((post) => parsePostUrl(post.originalUrl)?.id),
    );
    const [pasted] = posts.slice(-1);
    if (onCard.has(parsePostUrl(pasted.originalUrl)?.id)) {
      status.textContent = 'That post is already on the card.';
      return;
    }
    const earlier = posts
      .slice(0, -1)
      .filter((post) => !onCard.has(parsePostUrl(post.originalUrl)?.id));
    const chosen =
      earlier.length &&
      window.confirm(
        `This post replies to ${earlier.length === 1 ? 'an earlier post' : `${earlier.length} earlier posts`} that ${earlier.length === 1 ? "isn't" : "aren't"} on the card. Add ${earlier.length === 1 ? 'it' : 'them'} above it?`,
      )
        ? [...earlier, pasted]
        : [pasted];

    status.textContent = 'Saving its images and video…';
    try {
      const { data } = await axios.post(
        '/dynamic-api/micro/socialPost/twitter',
        { posts: chosen },
      );
      this.addPosts(data.posts);
    } catch (err) {
      status.textContent = err.response?.data?.error || err.message;
    }
  }

  addPost(post) {
    this.addPosts([post]);
  }

  addPosts(posts) {
    this.data = this.save();
    this.data.posts.push(...posts);
    this.adding = false;
    this.draw();
  }

  // A blank Twitter post, filled in from the link box if it holds a Twitter post link
  manualPost() {
    const url = this.wrapper.querySelector('.sp-url')?.value.trim();
    const parsed = parsePostUrl(url);
    return parsed?.network === 'twitter'
      ? blankPost('twitter', {
          handle: parsed.handle,
          originalUrl: url,
          profileUrl: twitterProfileUrl({ handle: parsed.handle }),
        })
      : blankPost('twitter');
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
      this.addPost(this.manualPost());
      return;
    }
    if (button.classList.contains('sp-add-post')) {
      this.adding = true;
      this.redraw();
      this.wrapper.querySelector('.sp-url').focus();
      return;
    }
    if (button.classList.contains('sp-screenshot-url')) {
      this.screenshotFromUrl();
      return;
    }
    if (button.classList.contains('sp-media-url')) {
      this.mediaFromUrl(button);
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

  // Use an image that's already online as the screenshot, e.g. one uploaded for another post
  async screenshotFromUrl() {
    try {
      const file = await chooseLinkedFile({ label: 'screenshot' });
      if (file) {
        this.data = this.save();
        this.data.screenshot = file.url;
        this.draw();
      }
    } catch (err) {
      window.alert(`Couldn't use that screenshot: ${err.message}`);
    }
  }

  // Add an image or video that's already online to a hand-entered post
  async mediaFromUrl(button) {
    try {
      const file = await chooseLinkedFile({
        accept: ['image', 'video'],
        label: 'image or video',
      });
      if (file) {
        this.data = this.save();
        this.postAt(button).media.push({
          type: file.contentType?.startsWith('video/') ? 'video' : 'image',
          src: file.url,
          alt: '',
          saved: true,
        });
        this.draw();
      }
    } catch (err) {
      window.alert(`Couldn't use that file: ${err.message}`);
    }
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
        updated.profileUrl = twitterProfileUrl(updated);
      }
      return updated;
    });
    return { ...this.data, posts };
  }

  validate(data) {
    return data.posts.length > 0;
  }
}
