import axios from 'axios';
import TomSelect from 'tom-select';

let tags = [];

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

  const saveButton = document.getElementById('save-button');
  saveButton.addEventListener('click', async function () {
    const pathParts = window.location.pathname.split('/');
    const entryType = pathParts[3];
    const entryId = pathParts[4];
    await axios
      .post(`/dynamic-api/feed/tags/${entryType}`, {
        id: entryId,
        tags,
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
        saveButton.removeAttribute('disabled');
      });
  });
}

document.addEventListener('DOMContentLoaded', onFirstLoad);
