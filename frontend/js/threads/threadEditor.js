import axios from 'axios';
import { collectMentionIds } from '../../../api/helpers/mentions.js';
import { NETWORK_LABELS } from '../../../api/helpers/socialMedia.js';
import {
  MEDIA_LIMIT,
  NETWORK_LIMITS,
  NETWORK_RULES,
  countCharacters,
  escapeText,
  fingerprintPost,
  formatTags,
  postParagraphs,
  postToNetworkText,
  threadProblems,
  visibleText,
} from '../../../api/helpers/socialThreads.js';
import { escapeHtml } from '../helpers/escapeHtml.js';
import { buildThread } from './buildThread.js';

export const SOCIAL_NETWORKS = ['bluesky', 'mastodon', 'twitter'];

const clone = (value) => JSON.parse(JSON.stringify(value));

// Contenteditable -> stored text ----------------------------------------------------------------

const escapeAttribute = (text) => escapeText(text).replace(/"/g, '&quot;');

/**
 * Read an editable post back into stored text: plain text, <br> and <a href> only. Browsers wrap
 * new lines in <div>s or <p>s in some cases; those become line breaks.
 * @param {Node} root
 * @returns {string}
 */
export function serializeEditable(root) {
  let html = '';
  root.childNodes.forEach((node, i) => {
    if (node.nodeType === Node.TEXT_NODE) {
      html += escapeText(node.textContent);
    } else if (node.nodeName === 'BR') {
      html += '<br>';
    } else if (node.nodeName === 'A' && node.getAttribute('href')) {
      html += `<a href="${escapeAttribute(node.getAttribute('href'))}">${serializeEditable(node)}</a>`;
    } else if (['DIV', 'P'].includes(node.nodeName)) {
      html += `${i > 0 ? '<br>' : ''}${serializeEditable(node)}`;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      html += serializeEditable(node);
    }
  });
  return html;
}

const trimBreaks = (html) =>
  html.replace(/^(\s|<br>)+/, '').replace(/(\s|<br>)+$/, '');

// Thread state ----------------------------------------------------------------------------------

export class ThreadEditors {
  /**
   * @param {Object} options
   * @param {Object} options.saved MicroEntry.socialThreads as saved, if any
   * @param {() => void} options.onChange Called after any change to any thread
   * @param {(tab: string) => void} options.showTab Switch the editor to a tab
   */
  constructor({ saved = {}, onChange, showTab }) {
    this.saved = saved || {};
    this.threads = {};
    this.mainPost = { blocks: [] };
    this.onChange = onChange;
    this.showTab = showTab;
    this.view = null; // The network shown in a platform tab, 'side-by-side', or null
    this.showDiff = false;
    this.entities = {}; // Mentioned entities by id, for turning mentions into handles
  }

  /**
   * Fetch any mentioned entities not loaded yet.
   * @param {{blocks: Object[]}} mainPost
   */
  async loadMentions(mainPost) {
    const missing = collectMentionIds([mainPost]).filter(
      (id) => !this.entities[id],
    );
    if (missing.length) {
      const { data } = await axios.get('/dynamic-api/entities', {
        params: { ids: missing.join(',') },
      });
      for (const entity of data) {
        this.entities[entity._id] = entity;
      }
    }
  }

  /**
   * Bring threads up to date with the main post. Saved edited threads are kept as they are;
   * everything else is rebuilt, keeping its Mastodon tags.
   * @param {{blocks: Object[]}} mainPost
   */
  async updateMainPost(mainPost) {
    await this.loadMentions(mainPost);
    this.mainPost = mainPost;
    for (const network of SOCIAL_NETWORKS) {
      const existing = this.threads[network] || this.saved[network];
      if (existing?.edited) {
        this.threads[network] = this.threads[network] || clone(existing);
      } else {
        this.threads[network] = buildThread(
          mainPost,
          network,
          existing?.tags || '',
          this.entities,
        );
      }
    }
    this.render();
  }

  summary(network) {
    const thread = this.threads[network];
    if (!thread) {
      return { posts: 0, problems: [] };
    }
    return {
      posts: thread.posts.length,
      problems: threadProblems(thread, network),
    };
  }

  isOutOfDate(network) {
    const thread = this.threads[network];
    return Boolean(
      thread?.edited && thread.basedOn?.hash !== fingerprintPost(this.mainPost),
    );
  }

  /** What's saved with the post. */
  toSave() {
    return clone(this.threads);
  }

  /** What the cross-posting endpoints take for one network. */
  forPosting(network) {
    const { posts, tags } = this.threads[network];
    return { posts, ...(network === 'mastodon' ? { tags } : {}) };
  }

  changed(network, { rerender = false } = {}) {
    this.threads[network].edited = true;
    if (rerender) {
      this.render();
    } else {
      this.refreshCounts();
    }
    this.onChange();
  }

  rebuild(network) {
    this.threads[network] = buildThread(
      this.mainPost,
      network,
      this.threads[network]?.tags || '',
      this.entities,
    );
    this.showDiff = false;
    this.render();
    this.onChange();
  }

  copyThread(from, to) {
    if (
      this.threads[to].edited &&
      !window.confirm(
        `Replace your edits to the ${NETWORK_LABELS[to]} thread with a copy of this one?`,
      )
    ) {
      return;
    }
    const posts = this.threads[from].posts.map((post) => ({
      // Links written out when copying away from Bluesky's rich text
      text:
        from === 'bluesky' && to !== 'bluesky'
          ? escapeText(postToNetworkText(post.text, to)).replace(/\n/g, '<br>')
          : post.text,
      media: clone(post.media),
    }));
    this.threads[to] = {
      ...this.threads[to],
      posts,
      edited: true,
      basedOn: clone(this.threads[from].basedOn),
    };
    this.render();
    this.onChange();
  }

  // Rendering -----------------------------------------------------------------------------------

  setView(view) {
    this.view = view;
    this.showDiff = false;
    this.render();
  }

  render() {
    if (this.view === 'side-by-side') {
      this.renderSideBySide();
    } else if (SOCIAL_NETWORKS.includes(this.view)) {
      this.renderPlatform(this.view);
      this.renderPlatformPanel(this.view);
    }
  }

  postElement(network, index) {
    const thread = this.threads[network];
    const post = thread.posts[index];
    const total = thread.posts.length;
    const element = document.createElement('div');
    element.className = 'thread-post';
    element.dataset.network = network;
    element.dataset.index = index;
    element.innerHTML = `
      <span class="post-number">${index + 1}/${total}</span>
      <div class="post-body">
        <div class="post-text" contenteditable="true" spellcheck="true"
          aria-label="${NETWORK_LABELS[network]} post ${index + 1}">${post.text}</div>
        <div class="post-media">${post.media
          .map(
            (item, i) => `
          <figure class="post-image" data-media="${i}">
            <img src="${escapeHtml(item.url)}" alt="">
            <button type="button" class="link-button alt-toggle">${item.alt ? 'alt text ✓' : 'add alt text'}</button>
            <span class="image-moves">
              ${index > 0 ? '<button type="button" class="link-button move-image" data-move="up" title="Move to the previous post" aria-label="Move image to the previous post">↑</button>' : ''}
              <button type="button" class="link-button move-image" data-move="down" title="${index < total - 1 ? 'Move to the next post' : 'Move to a new post'}" aria-label="${index < total - 1 ? 'Move image to the next post' : 'Move image to a new post'}">↓</button>
              ${i > 0 ? '<button type="button" class="link-button move-image" data-move="left" title="Move earlier in this post" aria-label="Move image earlier in this post">←</button>' : ''}
              ${i < post.media.length - 1 ? '<button type="button" class="link-button move-image" data-move="right" title="Move later in this post" aria-label="Move image later in this post">→</button>' : ''}
            </span>
            <button type="button" class="link-button remove-image" aria-label="Remove image">×</button>
            <textarea class="alt-input" hidden aria-label="Alt text">${escapeHtml(item.alt || '')}</textarea>
          </figure>`,
          )
          .join('')}</div>
        <div class="post-actions">
          <span class="chars-left"></span>
          <button type="button" class="link-button add-image">+ image</button>
          <button type="button" class="link-button split-post">split here</button>
          ${index < total - 1 ? '<button type="button" class="link-button merge-post">merge with next</button>' : ''}
          ${total > 1 ? '<button type="button" class="link-button delete-post">delete</button>' : ''}
        </div>
      </div>`;
    this.updatePostCount(element);
    return element;
  }

  updatePostCount(element) {
    const { network, index } = element.dataset;
    const thread = this.threads[network];
    const post = thread.posts[index];
    const left =
      NETWORK_LIMITS[network].post -
      countCharacters(post.text, network, thread.tags);
    const counter = element.querySelector('.chars-left');
    counter.textContent = left >= 0 ? `${left} left` : `${-left} over`;
    counter.classList.toggle('over-limit', left < 0);
    if (post.media.length > MEDIA_LIMIT) {
      counter.textContent += ` · more than ${MEDIA_LIMIT} images`;
      counter.classList.add('over-limit');
    }
  }

  refreshCounts() {
    for (const element of document.querySelectorAll('.thread-post')) {
      if (this.threads[element.dataset.network]) {
        this.updatePostCount(element);
      }
    }
    if (SOCIAL_NETWORKS.includes(this.view)) {
      this.renderPlatformPanel(this.view);
    }
  }

  renderPlatform(network) {
    const container = document.getElementById('platform-thread');
    const thread = this.threads[network];
    container.innerHTML = `
      <p class="thread-intro">Thread for ${NETWORK_LABELS[network]} · ${
        thread.edited
          ? 'started from the main post, edited separately'
          : 'follows the main post until you edit it'
      }</p>`;
    const list = document.createElement('div');
    list.className = 'thread-posts';
    thread.posts.forEach((_, i) =>
      list.appendChild(this.postElement(network, i)),
    );
    container.appendChild(list);
    container.insertAdjacentHTML(
      'beforeend',
      `<button type="button" class="link-button add-post" data-network="${network}">+ add post to thread</button>`,
    );
  }

  renderSideBySide() {
    const container = document.getElementById('side-by-side');
    const rows = Math.max(
      ...SOCIAL_NETWORKS.map((n) => this.threads[n].posts.length),
    );
    container.innerHTML = `<p class="thread-intro">Rows line up by post number, so a split that differs between platforms is easy to spot. Click any post to edit it.</p>`;
    const grid = document.createElement('div');
    grid.className = 'side-by-side-grid';
    for (const network of SOCIAL_NETWORKS) {
      grid.insertAdjacentHTML(
        'beforeend',
        `<div class="column-header">
          <h3>${NETWORK_LABELS[network]}</h3>
          <span class="social-limit">${NETWORK_LIMITS[network].post.toLocaleString()} per post ·
            <button type="button" class="link-button open-tab" data-network="${network}">open tab</button></span>
          ${network === 'mastodon' ? this.tagsField('side-by-side-tags') : ''}
        </div>`,
      );
    }
    for (let row = 0; row < rows; row++) {
      for (const network of SOCIAL_NETWORKS) {
        if (row < this.threads[network].posts.length) {
          grid.appendChild(this.postElement(network, row));
        } else {
          grid.insertAdjacentHTML(
            'beforeend',
            '<div class="empty-cell"></div>',
          );
        }
      }
    }
    for (const network of SOCIAL_NETWORKS) {
      grid.insertAdjacentHTML(
        'beforeend',
        `<button type="button" class="link-button add-post" data-network="${network}">+ add post</button>`,
      );
    }
    container.appendChild(grid);
  }

  tagsField(id) {
    return `<label class="side-label" for="${id}">Mastodon tags</label>
      <input id="${id}" class="mastodon-tags" type="text" value="${escapeHtml(this.threads.mastodon.tags || '')}" placeholder="crypto, law">`;
  }

  renderPlatformPanel(network) {
    const panel = document.getElementById('platform-panel');
    const thread = this.threads[network];
    const others = SOCIAL_NETWORKS.filter((n) => n !== network);
    const status = (n) => {
      const { posts, problems } = this.summary(n);
      const tags =
        n === 'mastodon' && formatTags(this.threads.mastodon.tags)
          ? ` · tags: ${formatTags(this.threads.mastodon.tags).split(' ').length}`
          : '';
      return `${posts} post${posts === 1 ? '' : 's'} · ${problems.length ? 'needs fixing' : 'ok'}${tags}`;
    };

    let notice = '';
    if (this.isOutOfDate(network)) {
      const before = thread.basedOn?.paragraphs || [];
      const now = postParagraphs(this.mainPost);
      const removed = before.filter((p) => !now.includes(p));
      const added = now.filter((p) => !before.includes(p));
      const diff = this.showDiff
        ? `<div class="post-diff">${removed
            .map((p) => `<del>${escapeHtml(p)}</del>`)
            .join(
              '',
            )}${added.map((p) => `<ins>${escapeHtml(p)}</ins>`).join('')}${
            removed.length || added.length
              ? ''
              : '<p>Only images, embeds or post breaks changed.</p>'
          }</div>`
        : '';
      notice = `
        <div class="changed-notice">
          <span class="side-label">Main post changed since this was written</span>
          <p>Your edits here are kept.
            <button type="button" class="link-button show-diff">${this.showDiff ? 'hide changes' : 'show what changed'}</button> ·
            <button type="button" class="link-button rebuild" data-network="${network}">rebuild from post</button></p>
          ${diff}
        </div>`;
    }

    const problems = threadProblems(thread, network);
    panel.innerHTML = `
      ${notice}
      <div class="side-section">
        <span class="side-label">${NETWORK_LABELS[network]} settings</span>
        <p>${NETWORK_LIMITS[network].post.toLocaleString()} characters per post · ${NETWORK_RULES[network]}</p>
        ${network === 'mastodon' ? this.tagsField('panel-tags') : ''}
        ${problems.length ? `<p class="over-limit">Fix before posting: ${escapeHtml(problems.join('; '))}</p>` : ''}
      </div>
      <div class="side-section">
        <span class="side-label">Other platforms</span>
        ${others
          .map(
            (n) =>
              `<p class="other-platform"><button type="button" class="link-button open-tab" data-network="${n}">${NETWORK_LABELS[n]}</button> <span class="side-hint">· ${status(n)}</span></p>`,
          )
          .join('')}
        ${others
          .map(
            (n) =>
              `<p><button type="button" class="link-button copy-thread" data-from="${network}" data-to="${n}">copy this thread to ${NETWORK_LABELS[n]}</button></p>`,
          )
          .join('')}
      </div>
      <div class="side-section">
        <span class="side-label">Already posted?</span>
        <button type="button" class="link-button link-post-ids">link existing post IDs</button>
      </div>`;
  }

  // Events --------------------------------------------------------------------------------------

  /**
   * Wire up the containers once; everything inside them is re-rendered freely.
   */
  attach() {
    const containers = [
      'platform-thread',
      'side-by-side',
      'platform-panel',
    ].map((id) => document.getElementById(id));
    this.fileInput = Object.assign(document.createElement('input'), {
      type: 'file',
      accept: 'image/*',
      hidden: true,
    });
    document.body.appendChild(this.fileInput);
    this.fileInput.addEventListener('change', () => this.uploadImage());

    for (const container of containers) {
      // Keep the caret in the post when clicking "split here".
      container.addEventListener('mousedown', (evt) => {
        if (evt.target.closest('.split-post')) {
          evt.preventDefault();
        }
      });
      container.addEventListener('click', (evt) => this.onClick(evt));
      container.addEventListener('input', (evt) => this.onInput(evt));
      container.addEventListener('keydown', (evt) => this.onKeydown(evt));
      container.addEventListener('paste', (evt) => this.onPaste(evt));
    }
  }

  postFor(element) {
    const postElement = element.closest('.thread-post');
    if (!postElement) {
      return {};
    }
    const { network, index } = postElement.dataset;
    return {
      postElement,
      network,
      index: Number(index),
      post: this.threads[network].posts[index],
    };
  }

  onKeydown(evt) {
    if (evt.target.classList?.contains('post-text') && evt.key === 'Enter') {
      // One line break per Enter, never a new <div>.
      evt.preventDefault();
      document.execCommand('insertLineBreak');
    }
  }

  onPaste(evt) {
    if (!evt.target.closest?.('.post-text')) {
      return;
    }
    // Paste as plain text: the platforms don't take formatting.
    evt.preventDefault();
    const lines = evt.clipboardData.getData('text/plain').split(/\r?\n/);
    lines.forEach((line, i) => {
      if (i > 0) {
        document.execCommand('insertLineBreak');
      }
      if (line) {
        document.execCommand('insertText', false, line);
      }
    });
  }

  onInput(evt) {
    const target = evt.target;
    if (target.classList.contains('mastodon-tags')) {
      this.threads.mastodon.tags = target.value;
      this.refreshCounts();
      this.onChange();
      return;
    }
    const { postElement, network, post } = this.postFor(target);
    if (!post) {
      return;
    }
    if (target.classList.contains('post-text')) {
      post.text = serializeEditable(target);
      this.threads[network].edited = true;
      this.updatePostCount(postElement);
      if (SOCIAL_NETWORKS.includes(this.view)) {
        this.renderPlatformPanel(this.view);
      }
      this.onChange();
    } else if (target.classList.contains('alt-input')) {
      const mediaIndex = Number(target.closest('.post-image').dataset.media);
      post.media[mediaIndex].alt = target.value;
      target.closest('.post-image').querySelector('.alt-toggle').textContent =
        target.value ? 'alt text ✓' : 'add alt text';
      this.threads[network].edited = true;
      this.onChange();
    }
  }

  onClick(evt) {
    const target = evt.target;
    const openTab = target.closest('.open-tab');
    if (openTab) {
      this.showTab(openTab.dataset.network);
      return;
    }
    if (target.closest('.link-post-ids')) {
      this.showTab('post');
      const details = document.querySelector('.social-links');
      details.open = true;
      details.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (target.closest('.show-diff')) {
      this.showDiff = !this.showDiff;
      this.renderPlatformPanel(this.view);
      return;
    }
    if (target.closest('.rebuild')) {
      if (
        window.confirm(
          'Rebuild this thread from the main post? Your edits to it will be lost.',
        )
      ) {
        this.rebuild(target.closest('.rebuild').dataset.network);
      }
      return;
    }
    const copy = target.closest('.copy-thread');
    if (copy) {
      this.copyThread(copy.dataset.from, copy.dataset.to);
      return;
    }
    const addPost = target.closest('.add-post');
    if (addPost) {
      const network = addPost.dataset.network;
      this.threads[network].posts.push({ text: '', media: [] });
      this.changed(network, { rerender: true });
      this.focusPost(network, this.threads[network].posts.length - 1);
      return;
    }

    const { network, index, post, postElement } = this.postFor(target);
    if (!post) {
      return;
    }
    const posts = this.threads[network].posts;
    if (target.closest('.split-post')) {
      this.splitPost(network, index, postElement.querySelector('.post-text'));
    } else if (target.closest('.merge-post')) {
      const next = posts[index + 1];
      post.text = [trimBreaks(post.text), trimBreaks(next.text)]
        .filter(Boolean)
        .join('<br><br>');
      post.media.push(...next.media);
      posts.splice(index + 1, 1);
      this.changed(network, { rerender: true });
    } else if (target.closest('.delete-post')) {
      if (
        visibleText(post.text).trim() &&
        !window.confirm('Delete this post from the thread?')
      ) {
        return;
      }
      posts.splice(index, 1);
      this.changed(network, { rerender: true });
    } else if (target.closest('.add-image')) {
      this.pendingImage = { network, index };
      this.fileInput.value = '';
      this.fileInput.click();
    } else if (target.closest('.move-image')) {
      this.moveImage(
        network,
        index,
        Number(target.closest('.post-image').dataset.media),
        target.closest('.move-image').dataset.move,
      );
    } else if (target.closest('.remove-image')) {
      post.media.splice(Number(target.closest('.post-image').dataset.media), 1);
      this.changed(network, { rerender: true });
    } else if (target.closest('.alt-toggle')) {
      const input = target.closest('.post-image').querySelector('.alt-input');
      input.hidden = !input.hidden;
      if (!input.hidden) {
        input.focus();
      }
    }
  }

  /**
   * Move an image, with its alt text: up to the end of the previous post, down to the start of
   * the next post (or a new post, from the last one), or left and right within its post.
   * @param {string} network
   * @param {number} index The post it's in
   * @param {number} mediaIndex Its position in that post
   * @param {'up'|'down'|'left'|'right'} direction
   */
  moveImage(network, index, mediaIndex, direction) {
    const posts = this.threads[network].posts;
    const media = posts[index].media;
    if (direction === 'left' || direction === 'right') {
      const swapWith = direction === 'left' ? mediaIndex - 1 : mediaIndex + 1;
      [media[mediaIndex], media[swapWith]] = [
        media[swapWith],
        media[mediaIndex],
      ];
    } else {
      const [image] = media.splice(mediaIndex, 1);
      if (direction === 'up') {
        posts[index - 1].media.push(image);
      } else {
        if (index === posts.length - 1) {
          posts.push({ text: '', media: [] });
        }
        posts[index + 1].media.unshift(image);
      }
    }
    this.changed(network, { rerender: true });
  }

  splitPost(network, index, textElement) {
    const selection = window.getSelection();
    if (
      !selection.rangeCount ||
      !textElement.contains(selection.getRangeAt(0).startContainer)
    ) {
      window.alert(
        'Put the cursor where the post should split, then click "split here".',
      );
      return;
    }
    const caret = selection.getRangeAt(0);
    const rest = document.createRange();
    rest.setStart(caret.startContainer, caret.startOffset);
    rest.setEnd(textElement, textElement.childNodes.length);
    const holder = document.createElement('div');
    holder.appendChild(rest.extractContents());
    const posts = this.threads[network].posts;
    posts[index].text = trimBreaks(serializeEditable(textElement));
    posts.splice(index + 1, 0, {
      text: trimBreaks(serializeEditable(holder)),
      media: [],
    });
    this.changed(network, { rerender: true });
    this.focusPost(network, index + 1);
  }

  focusPost(network, index) {
    document
      .querySelector(
        `.thread-post[data-network="${network}"][data-index="${index}"] .post-text`,
      )
      ?.focus();
  }

  async uploadImage() {
    const file = this.fileInput.files[0];
    if (!file || !this.pendingImage) {
      return;
    }
    const { network, index } = this.pendingImage;
    this.pendingImage = null;
    const form = new FormData();
    form.append('image', file);
    try {
      const { data } = await axios.post(
        '/dynamic-api/micro/image/byFile',
        form,
      );
      this.threads[network].posts[index].media.push({
        url: data.file.url,
        alt: '',
      });
      this.changed(network, { rerender: true });
    } catch (err) {
      console.error(err);
      window.alert(`Image upload failed: ${err.message}`);
    }
  }
}
