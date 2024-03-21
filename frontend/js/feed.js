import '../../css/feed.css';
// eslint-disable-next-line prettier/prettier, no-unused-vars
import fslightbox from 'fslightbox'

function onPageChangeClick(pageNumber) {
  const url = new URL(window.location);
  url.searchParams.set('page', pageNumber);
  window.location.replace(url);
}

(function () {
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
})();
