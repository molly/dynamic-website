import axios from 'axios';
import debounce from 'lodash.debounce';
import TomSelect from 'tom-select';
import { socialLinksToArray } from './helpers/editorHelpers.js';
import {
  createAboutPicker,
  createThreadPicker,
  selectedValues,
} from './helpers/pickers.js';

let socialLinks = {};

async function onFirstLoad() {
  const pickerData = JSON.parse(
    document.getElementById('picker-data').textContent,
  );

  // Tags: the input's initial value holds the entry's current tag IDs.
  const { data: tagOptions } = await axios.get('/dynamic-api/tags');
  const tagSelect = new TomSelect('#tags', {
    create: true,
    valueField: '_id',
    searchField: ['text'],
    options: tagOptions,
    maxOptions: null,
    closeAfterSelect: true,
  });

  const threadPicker = await createThreadPicker('#threads', {
    initial: pickerData.threads,
    preview: document.getElementById('threads-preview'),
    getPosition: () => ({
      at: pickerData.createdAt,
      feedEntryId: pickerData.feedEntryId,
    }),
  });
  const aboutPicker = createAboutPicker('#about', {
    initial: pickerData.about,
  });

  /**
   * Track social post IDs typed into the manual link fields
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
    saveButton.setAttribute('disabled', true);
    const pathParts = window.location.pathname.split('/');
    const entryType = pathParts[3];
    try {
      // Every field is read from its control, so saving never clears a field that wasn't touched.
      const { data: entry } = await axios.post(
        `/dynamic-api/feed/meta/${entryType}`,
        {
          id: pickerData.feedEntryId,
          tags: selectedValues(tagSelect),
          threads: selectedValues(threadPicker),
          about: selectedValues(aboutPicker),
          socialLinks: socialLinksToArray(socialLinks),
        },
      );
      const { data: allTags } = await axios.get('/dynamic-api/tags');
      tagSelect.clearOptions();
      tagSelect.addOptions(allTags);
      tagSelect.setValue(
        entry.tags.map((tag) => tag._id),
        true,
      );
      for (const link of entry.socialLinks || []) {
        document.getElementById(link.type).value = link.postId;
      }
      socialLinks = {};
    } catch (err) {
      console.error(err);
      window.alert(`Save failed: ${err.response?.data?.error || err.message}`);
    } finally {
      saveButton.removeAttribute('disabled');
    }
  });
}

document.addEventListener('DOMContentLoaded', onFirstLoad);
