import axios from 'axios';
import debounce from 'lodash.debounce';
import TomSelect from 'tom-select';
import { parseDuration } from '../../api/helpers/duration.js';
import { socialLinksToArray } from './helpers/editorHelpers.js';
import { suggestBetweenTagsAndAbout } from './helpers/tagSuggestions.js';
import { uploadFile } from './helpers/upload.js';
import {
  createAboutPicker,
  createThreadPicker,
  selectedValues,
} from './helpers/pickers.js';

let socialLinks = {};
// Others in a press talk or appearance (entities), on press entries only
let pressPeoplePicker = null;

// Press card fields ----------------------------------------------------------------------------

const PRESS_FIELDS = [
  'leadImage',
  'episode',
  'location',
  'slidesUrl',
  'transcriptUrl',
  'youtubeUrl',
  'mediaUrl',
  'posterUrl',
  'audioUrl',
];

// Show only the fields that apply to the chosen kind.
function showPressFieldsFor(kind) {
  document.querySelectorAll('#press-fields [data-kinds]').forEach((el) => {
    el.hidden = !el.dataset.kinds.split(' ').includes(kind);
  });
}

// The length of an uploaded video or audio file, from the browser.
function mediaDuration(url, kind) {
  return new Promise((resolve) => {
    const media = document.createElement(kind);
    media.preload = 'metadata';
    media.addEventListener('loadedmetadata', () => resolve(media.duration));
    media.addEventListener('error', () => resolve(null));
    media.src = url;
  });
}

function formatLength(seconds) {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

function initPressFields() {
  const section = document.getElementById('press-fields');
  if (!section) {
    return;
  }
  const kindSelect = document.getElementById('press-kind');
  showPressFieldsFor(kindSelect.value);
  kindSelect.addEventListener('change', () =>
    showPressFieldsFor(kindSelect.value),
  );

  const status = document.getElementById('press-upload-status');
  section.querySelectorAll('.press-upload').forEach((input) => {
    input.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) {
        return;
      }
      status.hidden = false;
      status.textContent = `Uploading ${file.name}…`;
      try {
        const { url } = await uploadFile(file);
        document.getElementById(input.dataset.target).value = url;
        const kind = file.type.split('/')[0];
        if (kind === 'video' || kind === 'audio') {
          const seconds = await mediaDuration(url, kind);
          if (Number.isFinite(seconds)) {
            document.getElementById('press-duration').value =
              formatLength(seconds);
          }
        }
        status.textContent = `Uploaded ${file.name}. Save to keep it.`;
      } catch (err) {
        status.textContent = `Upload failed: ${err.response?.data?.error || err.message}`;
      }
      input.value = '';
    });
  });
}

/**
 * The press card fields as the server takes them, or throws if the length can't be read.
 * @returns {?Object}
 */
function readPressFields() {
  if (!document.getElementById('press-fields')) {
    return null;
  }
  const duration = parseDuration(
    document.getElementById('press-duration').value,
  );
  if (Number.isNaN(duration)) {
    throw new Error(
      'Length should look like 52:30 or 1:02:30, or a number of minutes.',
    );
  }
  const fields = {
    kind: document.getElementById('press-kind').value,
    role: document.getElementById('press-role').value || null,
    duration,
    people: pressPeoplePicker ? selectedValues(pressPeoplePicker) : undefined,
  };
  for (const name of PRESS_FIELDS) {
    fields[name] =
      document.getElementById(`press-${name}`).value.trim() || null;
  }
  return fields;
}

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
  // #coinbase suggests @Coinbase for "about", and the other way round
  suggestBetweenTagsAndAbout({ tagSelect, aboutPicker });
  initPressFields();
  if (document.getElementById('press-people')) {
    pressPeoplePicker = createAboutPicker('#press-people', {
      initial: pickerData.pressPeople,
    });
  }

  /**
   * Track social post IDs typed into the manual link fields
   */
  function onSocialPostLinkChange() {
    if (this.value) {
      socialLinks[this.dataset.network] = this.value;
    } else {
      delete socialLinks[this.dataset.network];
    }
  }
  const debouncedOnSocialChange = debounce(onSocialPostLinkChange, 250);

  document
    .querySelectorAll('.social-post-id')
    .forEach((el) => el.addEventListener('input', debouncedOnSocialChange));

  const saveButton = document.getElementById('save-button');
  const lastSaved = document.getElementById('last-saved');
  const error = document.getElementById('tagger-error');
  saveButton.addEventListener('click', async function () {
    saveButton.setAttribute('disabled', true);
    error.hidden = true;
    try {
      // Every field is read from its control, so saving never clears a field that wasn't touched.
      const { data: entry } = await axios.post(
        `/dynamic-api/feed/meta/${pickerData.entryType}`,
        {
          id: pickerData.feedEntryId,
          tags: selectedValues(tagSelect),
          threads: selectedValues(threadPicker),
          about: selectedValues(aboutPicker),
          socialLinks: socialLinksToArray(socialLinks),
          press: readPressFields(),
        },
      );
      const uploadStatus = document.getElementById('press-upload-status');
      if (uploadStatus) {
        uploadStatus.hidden = true; // Its "save to keep it" is done
      }
      const { data: allTags } = await axios.get('/dynamic-api/tags');
      tagSelect.clearOptions();
      tagSelect.addOptions(allTags);
      tagSelect.setValue(
        entry.tags.map((tag) => tag._id),
        true,
      );
      for (const link of entry.socialLinks || []) {
        const input = document.getElementById(`post-id-${link.type}`);
        if (input) {
          input.value = link.postId;
        }
      }
      socialLinks = {};
      lastSaved.textContent = `saved ${new Date()
        .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
        .toLowerCase()}`;
    } catch (err) {
      console.error(err);
      error.textContent = `Couldn’t save: ${err.response?.data?.error || err.message}`;
      error.hidden = false;
      error.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } finally {
      saveButton.removeAttribute('disabled');
    }
  });
}

document.addEventListener('DOMContentLoaded', onFirstLoad);
