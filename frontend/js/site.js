// Redesigned pages: homepage, feed, micro posts. Fonts are self-hosted; a browser only downloads a
// face (and subset) once the page uses it.
import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource/instrument-serif/400.css';
import '@fontsource-variable/inter/opsz.css';
import '../../css/site.css';
import { fullLocal, formatLocal } from '../../api/helpers/localTimes.js';
import { initFeedPage } from './feedPage.js';

// The Menu button opens the full list of the site's pages.
function initMenu() {
  const button = document.getElementById('site-menu-button');
  const menu = document.getElementById('site-menu');
  if (!button || !menu) {
    return;
  }
  const setOpen = (open) => {
    button.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
  };
  button.addEventListener('click', () =>
    setOpen(button.getAttribute('aria-expanded') !== 'true'),
  );
  document.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape' && !menu.hidden) {
      setOpen(false);
      button.focus();
    }
  });
}

// Times are rendered in Eastern time; show them in the reader's own zone (api/helpers/localTimes.js).
function localizeTimes() {
  document.querySelectorAll('time[data-local][datetime]').forEach((el) => {
    const date = new Date(el.getAttribute('datetime'));
    if (Number.isNaN(date.getTime())) {
      return;
    }
    const ref = el.dataset.ref ? new Date(el.dataset.ref) : undefined;
    const text = formatLocal(date, el.dataset.local, { ref });
    if (text) {
      el.textContent = text;
      el.title = fullLocal(date);
    }
  });
}

// Document cards that show only their highlights carry the full passage in a template
// (api/helpers/sourceBlocks.js renderDocument). Add a button to switch between the two.
function initDocumentPassages() {
  document
    .querySelectorAll('template.document-full-passage')
    .forEach((template) => {
      const card = template.closest('.document-main');
      const notes = card?.querySelector('.document-notes');
      const highlights = template.previousElementSibling;
      if (!notes || !highlights) {
        return;
      }
      const full = template.content.firstElementChild;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'document-passage-toggle';
      button.textContent = 'show full passage';
      button.setAttribute('aria-expanded', 'false');
      button.addEventListener('click', () => {
        const showFull = button.getAttribute('aria-expanded') !== 'true';
        (showFull ? highlights : full).replaceWith(
          showFull ? full : highlights,
        );
        button.setAttribute('aria-expanded', String(showFull));
        button.textContent = showFull
          ? 'show only highlights'
          : 'show full passage';
      });
      notes.append(' · ', button);
    });
}

localizeTimes();
initMenu();
initDocumentPassages();
initFeedPage();
