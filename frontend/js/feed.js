import axios from 'axios';
import PrismJS from 'prismjs';
import '../../css/feed.css';

const BASE_URL = 'https://www.mollywhite.net';

const formatter = new Intl.DateTimeFormat('default', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  timeZoneName: 'short',
});

function onPageChangeClick(pageNumber) {
  const url = new URL(window.location);
  url.searchParams.set('page', pageNumber);
  window.location.replace(url);
}

async function onWebMentionSubmit(event) {
  event.preventDefault();
  event.target.disabled = true;

  const input = document.getElementById('webmention-manual');
  const source = input.value;
  const errorEl = document.getElementById('submit-error');
  if (!source) {
    errorEl.textContent = 'URL is required.';
    errorEl.classList.remove('hidden');
    event.target.disabled = false;
    return;
  }

  try {
    const targetUrl = new URL(window.location.href);
    await axios.post('/webmention/manual', {
      source,
      target: BASE_URL + targetUrl.pathname,
    });
    errorEl.classList.add('hidden');
    const successEl = document.getElementById('submit-success');
    successEl.innerHTML = 'Webmention submitted successfully.';
    successEl.classList.remove('hidden');
    input.value = '';
    event.target.disabled = false;
  } catch (err) {
    const errorMessage = err.response?.data?.error || err.message;
    errorEl.textContent = errorMessage;
    errorEl.classList.remove('hidden');
    event.target.disabled = false;
  }
}

(function () {
  // Convert timestamps to local timezone/formats
  document
    .querySelectorAll('.timestamp-block time')
    .forEach(function (timestamp) {
      const datetime = timestamp.getAttribute('datetime');
      const formatted = formatter.format(new Date(datetime));
      timestamp.setAttribute('title', formatted);
      if (!timestamp.textContent.includes('ago')) {
        timestamp.textContent = formatted;
      }
    });

  // Pagination handlers
  if (document.getElementById('paginator')) {
    document
      .getElementById('jump-to-start')
      ?.addEventListener('click', function () {
        onPageChangeClick(1);
      });
    document.querySelectorAll('.page-number-button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        onPageChangeClick(this.getAttribute('data-page-number'));
      });
    });
    document
      .getElementById('jump-to-end')
      ?.addEventListener('click', function () {
        onPageChangeClick(this.getAttribute('data-last-page'));
      });
  }

  // Webmention manual submission box
  const webmentionSubmitButton = document.getElementById(
    'webmention-manual-submit',
  );
  if (webmentionSubmitButton) {
    webmentionSubmitButton.addEventListener('click', onWebMentionSubmit);
  }

  PrismJS.highlightAll();
})();
