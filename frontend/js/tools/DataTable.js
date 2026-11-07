import Table from '@editorjs/table';

// @editorjs/table plus what small data tables on the site need: an optional total row, a source
// line and an "as of" date. Numeric columns are right-aligned when the post is shown, and a CSV
// download is generated from the cells, so neither needs anything here.

const TOTAL_ICON =
  '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 7V4H6l6 8-6 8h12v-3"/></svg>';

export default class DataTable extends Table {
  static get toolbox() {
    return { ...super.toolbox, title: 'Table' };
  }

  constructor(options) {
    super(options);
    const { data = {} } = options;
    this.data.totalRow = Boolean(data.totalRow);
    this.data.source = data.source || '';
    this.data.asOf = data.asOf || '';
  }

  render() {
    const container = super.render();
    container.classList.toggle('data-table--total', this.data.totalRow);
    const footer = document.createElement('div');
    footer.className = 'data-table-footer';
    footer.innerHTML = `
      <input type="text" class="data-table-source" placeholder="Source (e.g. FEC filings via Tech Influence Watch)" aria-label="Source">
      <label>as of <input type="date" class="data-table-as-of" aria-label="As of"></label>`;
    footer.querySelector('.data-table-source').value = this.data.source;
    footer.querySelector('.data-table-as-of').value = this.data.asOf;
    // Typing here shouldn't trigger the editor's own keyboard handling (Enter = new block).
    footer.addEventListener('keydown', (evt) => evt.stopPropagation());
    footer.addEventListener('paste', (evt) => evt.stopPropagation());
    if (this.readOnly) {
      footer
        .querySelectorAll('input')
        .forEach((input) => (input.disabled = true));
    }
    container.appendChild(footer);
    this.footer = footer;
    return container;
  }

  renderSettings() {
    return [
      ...super.renderSettings(),
      {
        label: 'Last row is a total',
        icon: TOTAL_ICON,
        isActive: this.data.totalRow,
        closeOnActivate: true,
        toggle: 'totalRow',
        onActivate: () => {
          this.data.totalRow = !this.data.totalRow;
          this.container.classList.toggle(
            'data-table--total',
            this.data.totalRow,
          );
        },
      },
    ];
  }

  save() {
    return {
      ...super.save(),
      totalRow: this.data.totalRow,
      source:
        this.footer?.querySelector('.data-table-source').value.trim() || '',
      asOf: this.footer?.querySelector('.data-table-as-of').value || '',
    };
  }
}
