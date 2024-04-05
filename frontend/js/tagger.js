import axios from 'axios';
import debounce from 'lodash.debounce';
import TomSelect from 'tom-select';
import { socialLinksToArray } from './helpers/editorHelpers.js';

let tags = [];
let socialLinks = {};

async function onFirstLoad() {
  // Load TomSelect for tags editor
  const { data: tagOptions } = await axios.get('/dynamic-api/tags');
  const tagSelect = new TomSelect('#tags', {
    create: true,
    valueField: '_id',
    searchField: ['text'],
    options: tagOptions,
    maxOptions: null,
    closeAfterSelect: true,
  });

  // TomSelect uses .on
  tagSelect.on('change', function (value) {
    if (value) {
      tags = value.split(',');
    } else {
      tags = [];
    }
  });

  /**
   * Update the postMeta.socialLinks when the social post link changes
   */
  function onSocialPostLinkChange() {
    if (this.value) {
      socialLinks[this.id] = this.value;
    } else {
      delete socialLinks[this.id];
    }
  }
  const debouncedOnSocialChange = debounce(onSocialPostLinkChange, 250);

  document
    .querySelectorAll('.social-post-id')
    .forEach((el) => el.addEventListener('keydown', debouncedOnSocialChange));

  const saveButton = document.getElementById('save-button');
  saveButton.addEventListener('click', async function () {
    const pathParts = window.location.pathname.split('/');
    const entryType = pathParts[3];
    const entryId = pathParts[4];
    await axios
      .post(`/dynamic-api/feed/tags/${entryType}`, {
        id: entryId,
        tags,
        socialLinks: socialLinksToArray(socialLinks),
      })
      .then((resp) => {
        return Promise.all([
          Promise.resolve(resp),
          axios.get('/dynamic-api/tags'),
        ]);
      })
      .then(([resp, tags]) => {
        tagSelect.clearOptions();
        tagSelect.addOptions(tags.data);
        tags = resp.data.tags;
        tagSelect.setValue(tags);
        for (let link of resp.data.socialLinks) {
          document.getElementById(link.type).value = link.postId;
        }
        socialLinks = {};
        saveButton.removeAttribute('disabled');
      })
      .catch((err) => {
        console.error(err);
      });
  });
}

document.addEventListener('DOMContentLoaded', onFirstLoad);
