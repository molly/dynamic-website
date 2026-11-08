import Quote from '@editorjs/quote';

// The quote block: @editorjs/quote, with a "Pull quote" setting. A pull quote is shown large, in
// the quote face; otherwise a quote is an excerpt, a step smaller than your own words. Within an
// excerpt, highlighted words are pulled out large, joined to the rest of it (api/helpers/blocks.js
// renderQuote).
// Data: { text, caption, alignment, style: 'pull' | 'excerpt' }. A quote is an excerpt unless
// it's made a pull quote, including one added by converting or pasting.

const PULL_ICON =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16M4 12h11M4 18h7"/></svg>';

export default class QuoteBlock extends Quote {
  static get sanitize() {
    return { ...super.sanitize, style: {} };
  }

  constructor(options) {
    super(options);
    this.data.style = options.data?.style === 'pull' ? 'pull' : 'excerpt';
  }

  render() {
    this.element = super.render();
    this.showStyle();
    return this.element;
  }

  // Pull quotes look large in the editor too
  showStyle() {
    this.element?.classList.toggle(
      'quote-block-pull',
      this.data.style === 'pull',
    );
  }

  renderSettings() {
    return [
      ...super.renderSettings(),
      {
        icon: PULL_ICON,
        label: 'Pull quote',
        toggle: true,
        isActive: this.data.style === 'pull',
        closeOnActivate: true,
        onActivate: () => {
          this.data.style = this.data.style === 'pull' ? 'excerpt' : 'pull';
          this.showStyle();
        },
      },
    ];
  }
}
