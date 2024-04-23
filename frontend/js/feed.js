import '../../css/feed.css';
import PrismJS from 'prismjs';

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

  PrismJS.highlightAll();
})();
