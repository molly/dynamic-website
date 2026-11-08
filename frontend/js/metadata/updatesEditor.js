import EditorJS from '@editorjs/editorjs';
import { UPDATE_LABELS } from '../../../api/helpers/updates.js';
import { editorToolConfig } from '../helpers/editorConfig.js';
import { escapeHtml } from '../helpers/escapeHtml.js';
import {
  fromLocalInput,
  newObjectId,
  nowLocalInput,
  toLocalInput,
} from './dates.js';

// Updates, corrections and live updates, written under the post. Each has its own small EditorJS
// for its body. Newest first, which is where you're working on a live post.
//
// Inline corrections in the post (see CorrectionTool) point at the correction note explaining them
// with data-update="<update id>". Corrections without a note are counted, with a button to write
// one.

const correctionText = (ins) => {
  const del = ins.previousElementSibling;
  const old =
    del?.tagName === 'DEL' && del.classList.contains('correction')
      ? del.textContent
      : null;
  return old
    ? `Corrected “${escapeHtml(old)}” to “${escapeHtml(ins.textContent)}”.`
    : `Corrected to “${escapeHtml(ins.textContent)}”.`;
};

async function saveEditor(editor) {
  await editor.isReady;
  return editor.save();
}

export class UpdatesEditor {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.postHolder The main post's EditorJS holder, to find corrections
   * @param {() => void} options.onChange
   */
  constructor({ postHolder, onChange }) {
    this.postHolder = postHolder;
    this.onChange = onChange;
    this.list = document.getElementById('updates-list');
    this.prompt = document.getElementById('corrections-prompt');
    this.liveButton = document.getElementById('add-live-update');
    this.items = []; // { id, kind, el, editor }

    for (const button of document.querySelectorAll('[data-add-update]')) {
      button.addEventListener('click', () =>
        this.add({ kind: button.dataset.addUpdate }, { focus: true }),
      );
    }
    this.list.addEventListener('click', (evt) => {
      const remove = evt.target.closest('.update-remove');
      if (remove) {
        const item = this.items.find(
          (i) => i.el === remove.closest('.update-item'),
        );
        if (
          window.confirm(
            `Remove this ${UPDATE_LABELS[item.kind].toLowerCase()}?`,
          )
        ) {
          this.remove(item);
        }
      }
    });
    this.list.addEventListener('input', () => this.onChange());
    this.prompt.addEventListener('click', (evt) => {
      if (evt.target.closest('button')) {
        this.addCorrectionNotes();
      }
    });
  }

  setLive(isLive) {
    this.liveButton.hidden = !isLive;
  }

  /**
   * @param {{_id?: string, kind: string, at?: string, headline?: string, body?: Object}} update
   * @param {{focus?: boolean, atEnd?: boolean}} [options]
   */
  add(update, { focus = false, atEnd = false } = {}) {
    const id = update._id || newObjectId();
    const el = document.createElement('div');
    el.className = `update-item ${update.kind}`;
    el.dataset.id = id;
    el.innerHTML = `
      <div class="update-head">
        <span class="update-kind">${UPDATE_LABELS[update.kind]}</span>
        <input type="datetime-local" step="60" class="update-at" aria-label="Time" value="${update.at ? toLocalInput(update.at) : nowLocalInput()}">
        <button type="button" class="link-button update-remove">remove</button>
      </div>
      ${update.kind === 'live' ? `<input type="text" class="update-headline" placeholder="Headline" aria-label="Headline" value="${escapeHtml(update.headline || '')}">` : ''}
      <div class="update-body"></div>`;
    if (atEnd) {
      this.list.append(el);
    } else {
      this.list.prepend(el);
    }
    const editor = new EditorJS({
      holder: el.querySelector('.update-body'),
      tools: editorToolConfig,
      data: update.body || {},
      minHeight: 40,
      placeholder:
        update.kind === 'correction' ? 'What was wrong' : 'Write the update',
      autofocus: focus && update.kind !== 'live',
      onChange: () => this.onChange(),
    });
    const item = { id, kind: update.kind, el, editor };
    this.items.push(item);
    if (focus && update.kind === 'live') {
      el.querySelector('.update-headline').focus();
    }
    this.checkCorrections();
    return item;
  }

  remove(item) {
    item.editor.destroy();
    item.el.remove();
    this.items.splice(this.items.indexOf(item), 1);
    this.checkCorrections();
    this.onChange();
  }

  setValue(updates = []) {
    for (const item of [...this.items]) {
      item.editor.destroy();
      item.el.remove();
    }
    this.items = [];
    [...updates]
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .forEach((update) => this.add(update, { atEnd: true }));
  }

  /** Inline corrections in the post with no correction note among these updates. */
  unexplainedCorrections() {
    const notes = new Set(
      this.items.filter((i) => i.kind === 'correction').map((i) => i.id),
    );
    return [...this.postHolder.querySelectorAll('ins.correction')].filter(
      (ins) => !notes.has(ins.dataset.update),
    );
  }

  checkCorrections() {
    const count = this.unexplainedCorrections().length;
    this.prompt.hidden = count === 0;
    this.prompt.innerHTML = count
      ? `${count === 1 ? 'A correction' : `${count} corrections`} in the post ${count === 1 ? 'has' : 'have'} no note. <button type="button" class="link-button">add ${count === 1 ? 'a note' : 'notes'}</button>`
      : '';
  }

  // A correction note for each unexplained correction, tied to it by id.
  addCorrectionNotes() {
    for (const ins of this.unexplainedCorrections()) {
      const item = this.add({
        kind: 'correction',
        body: {
          blocks: [{ type: 'paragraph', data: { text: correctionText(ins) } }],
        },
      });
      ins.dataset.update = item.id;
      const del = ins.previousElementSibling;
      if (del?.tagName === 'DEL' && del.classList.contains('correction')) {
        del.dataset.update = item.id;
      }
    }
    this.checkCorrections();
    this.onChange();
  }

  /** Every update's blocks, for finding links. */
  async blocks() {
    const bodies = await Promise.all(
      this.items.map((i) => saveEditor(i.editor)),
    );
    return bodies.flatMap((body) => body.blocks);
  }

  /** @returns {Promise<Object[]>} What the save route takes */
  async getValue() {
    const updates = await Promise.all(
      this.items.map(async (item, index) => {
        const body = await saveEditor(item.editor);
        const headline = item.el
          .querySelector('.update-headline')
          ?.value.trim();
        if (!body.blocks.length && !headline) {
          throw new Error(
            `${UPDATE_LABELS[item.kind]} ${index + 1} is empty; write it or remove it.`,
          );
        }
        return {
          _id: item.id,
          kind: item.kind,
          at:
            fromLocalInput(item.el.querySelector('.update-at').value) ||
            new Date().toISOString(),
          ...(item.kind === 'live' ? { headline } : {}),
          body,
        };
      }),
    );
    return updates.sort((a, b) => new Date(b.at) - new Date(a.at));
  }
}
