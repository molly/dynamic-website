import axios from 'axios';
document.addEventListener('DOMContentLoaded', onFirstLoad);

async function parseWebmention(event) {
  const webmentionId = event.target.dataset.id;
  const { data } = await axios.post('/webmention/parse', {
    id: webmentionId,
  });
  if (data.error) {
    const errorContainer = document.getElementById(`error-${webmentionId}`);
    errorContainer.textContent = data.error;
    errorContainer.classList.remove('hidden');
    return;
  }
  if (data.author) {
    document.getElementById(`author-${webmentionId}`).value = data.author;
  }
  if (data.authorUrl) {
    document.getElementById(`author-url-${webmentionId}`).value =
      data.authorUrl;
  }
  if (data.type) {
    document.getElementById(`type-${webmentionId}`).value = data.type;
  }
  if (data.published) {
    document.getElementById(`published-${webmentionId}`).value = data.published;
  }
  if (data.content) {
    document.getElementById(`content-${webmentionId}`).value = data.content;
  }
  if (data.summary) {
    document.getElementById(`summary-${webmentionId}`).value = data.summary;
  }
  document
    .getElementById('approve')
    .addEventListener('click', approveWebmention);
  document.getElementById(`result-${webmentionId}`).classList.remove('hidden');
}

async function approveWebmention(event) {
  const webmentionId = event.target.dataset.id;
  const body = {};
  if (document.getElementById(`author-${webmentionId}`).value) {
    body.author = document.getElementById(`author-${webmentionId}`).value;
  }
  if (document.getElementById(`author-url-${webmentionId}`).value) {
    body.authorUrl = document.getElementById(
      `author-url-${webmentionId}`,
    ).value;
  }
  if (document.getElementById(`type-${webmentionId}`).value) {
    body.type = document.getElementById(`type-${webmentionId}`).value;
  }
  if (document.getElementById(`published-${webmentionId}`).value) {
    body.published = document.getElementById(`published-${webmentionId}`).value;
  }
  if (document.getElementById(`content-${webmentionId}`).value) {
    body.content = document.getElementById(`content-${webmentionId}`).value;
  }
  if (document.getElementById(`summary-${webmentionId}`).value) {
    body.summary = document.getElementById(`summary-${webmentionId}`).value;
  }

  await axios.post('/webmention/approve', {
    id: webmentionId,
    body,
  });

  document.getElementById(`result-${webmentionId}`).classList.add('hidden');
}

function onFirstLoad() {
  const parseButtons = document.querySelectorAll('button.parse');
  for (const button of parseButtons) {
    button.addEventListener('click', parseWebmention);
  }
}
