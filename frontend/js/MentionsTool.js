import {
  MENTION_NETWORKS,
  getSocialLinkFromHandle,
} from '../../api/helpers/socialMedia.js';

const getSvgIcon = async (network) => {
  const svg = await import(
    `!!svg-inline-loader!../../pug/icons/${network}.svg`
  );
  const iconEl = document.createElement('SPAN');
  iconEl.classList.add('cdx-mention-icon', 'icon');
  iconEl.style.width = network === 'wikipedia' ? '14px' : '10px';
  iconEl.innerHTML = svg.default;
  iconEl.firstChild.style.width = network === 'wikipedia' ? '14px' : '10px';
  return iconEl;
};

export default class MarkerTool {
  static get isInline() {
    return true;
  }

  static get sanitize() {
    return {
      span: { class: true, style: true },
      svg: function (el) {
        return el.parentElement.classList.contains('cdx-mention-icon');
      },
      path: function (el) {
        return el.parentElement.parentElement.classList.contains(
          'cdx-mention-icon',
        );
      },
      a: function (el) {
        if (el.classList.contains('u-url')) {
          return {
            href: true,
            class: true,
            title: true,
            'data-username': true,
            style: true,
          };
        }
        return { href: true, target: true, rel: true, style: true };
      },
    };
  }

  get state() {
    return this._state;
  }

  set state(state) {
    this._state = state;
    if (this.button) {
      this.button.classList.toggle(
        this.api.styles.inlineToolButtonActive,
        state,
      );
    }
  }

  constructor({ api }) {
    this.api = api;
    this.button = null;
    this._state = false;

    this.tag = 'SPAN';
    this.class = 'cdx-mention';
    this.networks = {};

    const parentTag = this.api.selection.findParentTag(this.tag, this.class);
    if (parentTag) {
      for (let network of MENTION_NETWORKS) {
        const networkEl = parentTag.querySelector(`.${network}`);
        if (networkEl) {
          this.networks[network] =
            networkEl.getAttribute('data-username') || networkEl.href;
        }
      }
    }
  }

  clear() {
    this.networks = {};
  }

  render() {
    this.button = document.createElement('button');
    this.button.type = 'button';
    this.button.textContent = '@';
    this.button.classList.add(this.api.styles.inlineToolButton);
    return this.button;
  }

  surround(range) {
    if (this.state) {
      this.unwrap(range);
      return;
    }
    this.wrap(range);
  }

  // Add span tag representing mention node
  wrap(range) {
    const selectedText = range.extractContents();
    const wrapper = document.createElement(this.tag);
    wrapper.classList.add(this.class, 'u-category', 'h-card');

    const plainText = document.createElement('SPAN');
    plainText.classList.add('cdx-mention-plain');
    plainText.appendChild(selectedText);

    wrapper.appendChild(plainText);
    range.insertNode(wrapper);

    this.api.selection.expandToTag(wrapper);
  }

  // Remove span tag representing mention node
  unwrap(range) {
    const span = this.api.selection.findParentTag(this.tag, this.class);
    const plainText = span.querySelector('.cdx-mention-plain').firstChild;
    span.remove();
    range.insertNode(plainText);
  }

  checkState() {
    const span = this.api.selection.findParentTag(this.tag, this.class);
    this.state = !!span;

    if (this.state) {
      this.showActions(span);
    } else {
      this.hideActions();
    }
  }

  renderActions() {
    this.inputBoxWrapper = document.createElement('DIV');
    this.inputs = [];
    for (let network of MENTION_NETWORKS) {
      const input = document.createElement('input');
      input.classList.add('cdx-mention-input');
      input.id = network;
      this.networks[network] && (input.value = this.networks[network]);
      input.placeholder = network.charAt(0).toUpperCase() + network.slice(1);
      this.inputBoxWrapper.appendChild(input);
      this.inputs.push(input);
    }
    this.inputBoxWrapper.hidden = true;

    return this.inputBoxWrapper;
  }

  showActions(mention) {
    this.inputs.forEach((input) => {
      input.onchange = async () => {
        const networkLink = mention.querySelector(`.${input.id}`);
        if (!input.value) {
          delete this.networks[input.id];
          networkLink.remove();
        } else {
          this.networks[input.id] = input.value;
          if (networkLink) {
            networkLink.href = getSocialLinkFromHandle(input.value, input.id);
            networkLink.setAttribute('data-username', input.value);
          } else {
            const link = document.createElement('A');
            link.classList.add(input.id, 'u-url');
            link.href = getSocialLinkFromHandle(input.value, input.id);

            if (input.id === 'website') {
              // For websites, link the primary text
              link.classList.add('p-name');
              const plainText = mention.querySelector('.cdx-mention-plain');
              link.appendChild(plainText.cloneNode(true));
              plainText.replaceWith(link);
            } else {
              // For other social networks, add the link after the primary text
              link.classList.add('cdx-social-link');
              link.style.padding = '0 0.025em';
              link.style.marginLeft = '0.05em';
              link.setAttribute('data-username', input.value);
              link.appendChild(await getSvgIcon(input.id));
              link.title = input.id.charAt(0).toUpperCase() + input.id.slice(1);

              // Insert at the proper location
              const networkIndex = MENTION_NETWORKS.indexOf(input.id);
              let inserted = false;
              for (let laterNetwork of MENTION_NETWORKS.slice(networkIndex)) {
                const laterNetworkEl = mention.querySelector(
                  `.${laterNetwork}`,
                );
                if (laterNetworkEl) {
                  mention.insertBefore(link, laterNetworkEl);
                  inserted = true;
                  return;
                }
              }
              if (!inserted) {
                mention.appendChild(link);
              }
            }
          }
        }
      };
    });
    this.inputBoxWrapper.hidden = false;
  }

  hideActions() {
    this.inputBoxWrapper.onchange = null;
    this.inputBoxWrapper.hidden = true;
  }
}
