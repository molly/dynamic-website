import axios from 'axios';
document.addEventListener('DOMContentLoaded', onFirstLoad);

const FIELDS = [
  ['author', 'author'],
  ['authorUrl', 'author-url'],
  ['type', 'type'],
  ['published', 'published'],
  ['content', 'content'],
  ['summary', 'summary'],
];

function showMessage(webmentionId, message) {
  const container = document.getElementById(`error-${webmentionId}`);
  container.textContent = message;
  container.classList.toggle('hidden', !message);
}

function showBulkStatus(message) {
  document.getElementById('bulk-status').textContent = message;
}

function errorMessage(err) {
  return err.response?.data?.error || err.message;
}

function removeWebmention(webmentionId) {
  document.getElementById(`webmention-${webmentionId}`)?.remove();
  updateBulkControls();
}

function getCheckboxes() {
  return Array.from(document.querySelectorAll('input.select-webmention'));
}

function getSelectedIds() {
  return getCheckboxes()
    .filter((box) => box.checked)
    .map((box) => box.dataset.id);
}

// The form is shown once a webmention has been parsed, and may have been edited
function hasOpenForm(webmentionId) {
  return !document
    .getElementById(`result-${webmentionId}`)
    .classList.contains('hidden');
}

function getFormBody(webmentionId) {
  const body = {};
  for (const [key, idPrefix] of FIELDS) {
    const value = document.getElementById(`${idPrefix}-${webmentionId}`).value;
    if (value) {
      body[key] = value;
    }
  }
  return body;
}

function updateBulkControls() {
  const boxes = getCheckboxes();
  const selectedCount = boxes.filter((box) => box.checked).length;
  const selectAll = document.getElementById('select-all');
  if (!selectAll) {
    return;
  }
  selectAll.checked = boxes.length > 0 && selectedCount === boxes.length;
  selectAll.indeterminate = selectedCount > 0 && selectedCount < boxes.length;
  document.getElementById('approve-selected').disabled = selectedCount === 0;
  document.getElementById('reject-selected').disabled = selectedCount === 0;
}

async function parseWebmention(event) {
  const webmentionId = event.target.dataset.id;
  showMessage(webmentionId, '');
  let data;
  try {
    ({ data } = await axios.post('/webmention/parse', { id: webmentionId }));
  } catch (err) {
    showMessage(webmentionId, errorMessage(err));
    return;
  }
  if (data.warning) {
    showMessage(webmentionId, `${data.warning} Fill in details manually.`);
  }
  for (const [key, idPrefix] of FIELDS) {
    if (data[key]) {
      document.getElementById(`${idPrefix}-${webmentionId}`).value = data[key];
    }
  }
  document.getElementById(`result-${webmentionId}`).classList.remove('hidden');
}

async function approveWebmention(event) {
  const webmentionId = event.target.dataset.id;
  try {
    await axios.post('/webmention/approve', {
      id: webmentionId,
      body: getFormBody(webmentionId),
    });
  } catch (err) {
    showMessage(webmentionId, errorMessage(err));
    return;
  }
  removeWebmention(webmentionId);
}

async function rejectWebmentions(ids) {
  await axios.post('/webmention/reject', { ids });
  ids.forEach(removeWebmention);
}

async function rejectWebmention(event) {
  const webmentionId = event.target.dataset.id;
  if (!window.confirm('Reject this webmention?')) {
    return;
  }
  try {
    await rejectWebmentions([webmentionId]);
  } catch (err) {
    showMessage(webmentionId, errorMessage(err));
  }
}

async function rejectSelected() {
  const ids = getSelectedIds();
  if (!ids.length || !window.confirm(`Reject ${ids.length} webmention(s)?`)) {
    return;
  }
  showBulkStatus('Rejecting…');
  try {
    await rejectWebmentions(ids);
    showBulkStatus(`Rejected ${ids.length}.`);
  } catch (err) {
    showBulkStatus(`Reject failed: ${errorMessage(err)}`);
  }
}

async function approveSelected() {
  const ids = getSelectedIds();
  if (!ids.length) {
    return;
  }
  showBulkStatus('Approving…');
  ids.forEach((id) => showMessage(id, ''));

  // Use the form values for anything that's already been parsed (and maybe
  // edited); parse the rest on the server.
  const withForm = ids.filter(hasOpenForm);
  const toParse = ids.filter((id) => !hasOpenForm(id));
  const approved = [];
  const skipped = [];

  await Promise.all(
    withForm.map(async (id) => {
      try {
        await axios.post('/webmention/approve', {
          id,
          body: getFormBody(id),
        });
        approved.push(id);
      } catch (err) {
        skipped.push({ id, reason: errorMessage(err) });
      }
    }),
  );

  if (toParse.length) {
    try {
      const { data } = await axios.post('/webmention/approve-bulk', {
        ids: toParse,
      });
      approved.push(...data.approved);
      skipped.push(...data.skipped);
    } catch (err) {
      toParse.forEach((id) => skipped.push({ id, reason: errorMessage(err) }));
    }
  }

  approved.forEach(removeWebmention);
  for (const { id, reason } of skipped) {
    showMessage(id, `Not approved: ${reason}`);
  }
  showBulkStatus(
    `Approved ${approved.length}.` +
      (skipped.length
        ? ` ${skipped.length} need manual review (still selected).`
        : ''),
  );
}

function onFirstLoad() {
  const handlers = [
    ['button.parse', parseWebmention],
    ['button.approve', approveWebmention],
    ['button.reject', rejectWebmention],
    ['#approve-selected', approveSelected],
    ['#reject-selected', rejectSelected],
  ];
  for (const [selector, handler] of handlers) {
    for (const button of document.querySelectorAll(selector)) {
      button.addEventListener('click', handler);
    }
  }

  for (const box of getCheckboxes()) {
    box.addEventListener('change', updateBulkControls);
  }
  document.getElementById('select-all')?.addEventListener('change', (event) => {
    for (const box of getCheckboxes()) {
      box.checked = event.target.checked;
    }
    updateBulkControls();
  });
  updateBulkControls();
}
