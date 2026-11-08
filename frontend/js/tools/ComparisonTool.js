import { escapeHtml } from '../helpers/escapeHtml.js';
import { isolateKeys } from './DocumentTool.js';
import ImageSourceTune from './ImageSourceTune.js';

// "Comparison" block: two labelled sides, e.g. "THE HEADLINE · REUTERS" beside "THE SOURCE ·
// @BINANCE", each holding one block of any kind offered (image, social post, document, linked
// article or text). EditorJS doesn't nest blocks, so each side runs the chosen tool itself and
// stores what it saves.
// Data: { left: { label, block: { type, data, tunes } }, right: { … } }. An image side has the
// same "source details" as an image block (tunes.imageSource), shown under it on the site.

// Block types whose side gets the image source details
const SOURCED = new Set(['image', 'gallery']);

// A tool's own settings (its renderSettings) that make no sense on one side of a comparison:
// stretching would stretch the whole comparison block
const SIDE_SETTINGS_LEFT_OUT = new Set(['stretched']);
// Config: { tools: { [type]: { class, config, title } } }, set in editorConfig.js.

const SIDES = ['left', 'right'];

// A side's plain text, saved as a paragraph block so the site renders it like one.
class TextSlot {
  constructor({ data, readOnly }) {
    this.data = data;
    this.readOnly = readOnly;
  }

  render() {
    const el = document.createElement('div');
    el.className = 'comparison-text';
    el.contentEditable = String(!this.readOnly);
    el.dataset.placeholder = 'Text';
    el.innerHTML = this.data.text || '';
    return el;
  }

  save(el) {
    return { text: el.innerHTML.replace(/(<br>)+$/, '') };
  }

  validate(data) {
    return Boolean(data.text.trim());
  }
}

export default class ComparisonTool {
  static get toolbox() {
    return {
      title: 'Comparison',
      icon: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/></svg>',
    };
  }

  static get isReadOnlySupported() {
    return true;
  }

  // Each side's block is cleaned by its own renderer on the site; sanitizing here would escape
  // plain text fields and strip markup the inner tools keep.
  static get sanitize() {
    return { left: true, right: true };
  }

  constructor({ data, config, api, readOnly, block }) {
    this.api = api;
    this.block = block;
    this.readOnly = readOnly;
    this.tools = {
      ...(config.tools || {}),
      paragraph: { class: TextSlot, title: 'Text' },
    };
    this.data = {
      left: { label: '', block: null, ...data.left },
      right: { label: '', block: null, ...data.right },
    };
    this.slots = {}; // side -> { tool, element } while a block is showing
  }

  render() {
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'comparison-tool';
    isolateKeys(this.wrapper);
    this.wrapper.innerHTML = SIDES.map(
      (side) => `
      <div class="comparison-tool-side" data-side="${side}">
        <input type="text" class="comparison-label-input" placeholder="Label, e.g. ${side === 'left' ? 'THE HEADLINE · REUTERS' : 'THE SOURCE · @BINANCE'}" aria-label="${side} label" value="${escapeHtml(this.data[side].label)}"${this.readOnly ? ' disabled' : ''}>
        <div class="comparison-slot"></div>
      </div>`,
    ).join('');
    this.wrapper.addEventListener('click', (evt) => this.onClick(evt));
    return this.wrapper;
  }

  rendered() {
    for (const side of SIDES) {
      this.showSide(side);
    }
  }

  slotEl(side) {
    return this.wrapper.querySelector(`[data-side="${side}"] .comparison-slot`);
  }

  async showSide(side) {
    const slotEl = this.slotEl(side);
    const block = this.data[side].block;
    slotEl.innerHTML = '';
    delete this.slots[side];
    if (!block || !this.tools[block.type]) {
      if (!this.readOnly) {
        slotEl.innerHTML = `<p class="comparison-choose">Add ${Object.entries(
          this.tools,
        )
          .map(
            ([type, settings]) =>
              `<button type="button" class="link-button" data-choose="${type}">${escapeHtml(settings.title || type)}</button>`,
          )
          .join(' · ')}</p>`;
      }
      return;
    }
    const settings = this.tools[block.type];
    const tool = new settings.class({
      data: block.data || {},
      config: settings.config || {},
      api: this.api,
      readOnly: this.readOnly,
      block: this.block,
    });
    let element = await tool.render();
    // Block tunes don't reach a tool run here, so an image side runs its source details itself
    const sourceTune = SOURCED.has(block.type)
      ? new ImageSourceTune({
          data: block.tunes?.imageSource || {},
          readOnly: this.readOnly,
        })
      : null;
    const content = element;
    if (sourceTune) {
      element = sourceTune.wrap(content);
    }
    slotEl.append(element);
    tool.rendered?.();
    // A block's own settings normally live in the block's settings menu, which a tool run here
    // doesn't get; they're shown under it instead
    if (tool.renderSettings && !this.readOnly) {
      slotEl.append(this.settingsRow(tool));
    }
    if (sourceTune && !this.readOnly) {
      const details = document.createElement('button');
      details.type = 'button';
      details.className = 'link-button comparison-source';
      details.textContent = 'source details';
      details.addEventListener('click', () => sourceTune.render().onActivate());
      slotEl.append(details, ' · ');
    }
    if (!this.readOnly) {
      const change = document.createElement('button');
      change.type = 'button';
      change.className = 'link-button comparison-change';
      change.dataset.change = side;
      change.textContent = `change ${(settings.title || block.type).toLowerCase()}`;
      slotEl.append(change);
    }
    this.slots[side] = {
      tool,
      element: content,
      type: block.type,
      sourceTune,
    };
  }

  // Toggles for a tool's own settings: "with border · with background · …", each showing
  // whether it's on
  settingsRow(tool) {
    const row = document.createElement('p');
    row.className = 'comparison-settings';
    const draw = () => {
      const settings = [tool.renderSettings()]
        .flat()
        .filter(
          (item) => item?.label && !SIDE_SETTINGS_LEFT_OUT.has(item.name),
        );
      row.replaceChildren(
        ...settings.flatMap((item, i) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'link-button';
          button.setAttribute('aria-pressed', String(Boolean(item.isActive)));
          button.textContent = item.label.toLowerCase();
          button.addEventListener('click', () => {
            item.onActivate();
            draw(); // Read the settings again for their new state
          });
          return i ? [' · ', button] : [button];
        }),
      );
    };
    draw();
    return row;
  }

  onClick(evt) {
    const choose = evt.target.closest('[data-choose]');
    const change = evt.target.closest('[data-change]');
    if (choose) {
      const side = choose.closest('[data-side]').dataset.side;
      this.data[side].block = { type: choose.dataset.choose, data: {} };
      this.showSide(side);
    } else if (change) {
      const side = change.dataset.change;
      if (window.confirm('Replace this side? What’s in it will be removed.')) {
        this.data[side].block = null;
        this.showSide(side);
      }
    }
  }

  async save() {
    const data = {};
    for (const side of SIDES) {
      const label = this.wrapper
        .querySelector(`[data-side="${side}"] .comparison-label-input`)
        .value.trim();
      const slot = this.slots[side];
      let block = this.data[side].block;
      if (slot) {
        const saved = await slot.tool.save(slot.element);
        const valid = slot.tool.validate ? slot.tool.validate(saved) : true;
        const source = slot.sourceTune?.save();
        const hasSource =
          source && Object.values(source).some((value) => value);
        block = valid
          ? {
              type: slot.type,
              data: saved,
              ...(hasSource ? { tunes: { imageSource: source } } : {}),
            }
          : null;
      }
      data[side] = { label, block };
    }
    return data;
  }

  validate(data) {
    return Boolean(data.left.block || data.right.block);
  }
}
