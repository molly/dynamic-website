// Inline tool for corrections: select the old wording, type the corrected wording, and the post
// keeps both, the old struck through: <del class="correction">old</del><ins class="correction">new</ins>.
// Cross-posts use only the new wording.

const CLASS = 'correction';

export default class CorrectionTool {
  static get isInline() {
    return true;
  }

  static get title() {
    return 'Correction';
  }

  static get sanitize() {
    // data-update ties a correction to its note in the post's updates
    return {
      del: { class: true, 'data-update': true },
      ins: { class: true, 'data-update': true },
    };
  }

  constructor({ api }) {
    this.api = api;
    this.button = null;
    this.range = null;
  }

  render() {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/><path d="M8 6h8M8 18h8"/></svg>';
    this.button.title = 'Correction: strike the old wording, add the new';
    this.button.classList.add(this.api.styles.inlineToolButton);
    return this.button;
  }

  findCorrection() {
    return (
      this.api.selection.findParentTag('DEL', CLASS) ||
      this.api.selection.findParentTag('INS', CLASS)
    );
  }

  surround(range) {
    if (this.findCorrection()) {
      return; // Handled from the actions panel
    }
    this.range = range.cloneRange();
    this.actions.innerHTML = `
      <label class="correction-label">Corrected wording
        <input type="text" class="correction-input">
      </label>`;
    this.actions.hidden = false;
    const input = this.actions.querySelector('input');
    input.value = range.toString();
    input.select();
    input.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter') {
        evt.preventDefault();
        this.apply(input.value);
      } else if (evt.key === 'Escape') {
        this.close();
      }
    });
    input.focus();
  }

  apply(corrected) {
    if (!this.range) {
      return;
    }
    const del = document.createElement('del');
    del.className = CLASS;
    del.appendChild(this.range.extractContents());
    const ins = document.createElement('ins');
    ins.className = CLASS;
    ins.textContent = corrected;
    this.range.insertNode(ins);
    this.range.insertNode(del);
    this.range = null;
    this.close();
  }

  // Resolve a correction: keep only the new wording.
  resolve(element) {
    const del =
      element.tagName === 'DEL' ? element : element.previousElementSibling;
    const ins =
      element.tagName === 'INS' ? element : element.nextElementSibling;
    if (del?.tagName === 'DEL' && del.classList.contains(CLASS)) {
      del.remove();
    }
    if (ins?.tagName === 'INS' && ins.classList.contains(CLASS)) {
      ins.replaceWith(...ins.childNodes);
    }
    this.close();
  }

  checkState() {
    const correction = this.findCorrection();
    this.button?.classList.toggle(
      this.api.styles.inlineToolButtonActive,
      Boolean(correction),
    );
    if (correction) {
      this.actions.innerHTML =
        '<p class="mention-current">Correction · <button type="button" class="link-button resolve-correction">keep only the new wording</button></p>';
      this.actions.hidden = false;
      this.actions.querySelector('.resolve-correction').onclick = () =>
        this.resolve(correction);
    } else if (!this.range) {
      this.actions.hidden = true;
    }
    return Boolean(correction);
  }

  renderActions() {
    this.actions = document.createElement('div');
    this.actions.className = 'mention-actions';
    this.actions.hidden = true;
    this.actions.addEventListener('mousedown', (evt) => {
      if (evt.target.closest('button')) {
        evt.preventDefault();
      }
    });
    return this.actions;
  }

  close() {
    this.actions.hidden = true;
    this.actions.innerHTML = '';
    this.api.inlineToolbar.close();
  }

  clear() {
    if (!this.range) {
      this.actions.hidden = true;
    }
  }
}
