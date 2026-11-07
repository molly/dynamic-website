// Inline tool: highlight words with <mark>, for pull quotes and "highlight mine" in excerpts.
export default class HighlightTool {
  static get isInline() {
    return true;
  }

  static get title() {
    return 'Highlight';
  }

  static get sanitize() {
    return { mark: true };
  }

  constructor({ api }) {
    this.api = api;
    this.button = null;
  }

  render() {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l-6 6v3h3l6-6"/><path d="M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>';
    this.button.title = 'Highlight';
    this.button.classList.add(this.api.styles.inlineToolButton);
    return this.button;
  }

  surround(range) {
    const mark = this.api.selection.findParentTag('MARK');
    if (mark) {
      mark.replaceWith(...mark.childNodes);
      return;
    }
    const wrapper = document.createElement('mark');
    wrapper.appendChild(range.extractContents());
    range.insertNode(wrapper);
    this.api.selection.expandToTag(wrapper);
  }

  checkState() {
    const active = Boolean(this.api.selection.findParentTag('MARK'));
    this.button?.classList.toggle(
      this.api.styles.inlineToolButtonActive,
      active,
    );
    return active;
  }
}
