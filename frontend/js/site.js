// Redesigned pages: homepage, feed, micro posts. Fonts are self-hosted; a browser only downloads a
// face (and subset) once the page uses it.
import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import '@fontsource-variable/jetbrains-mono';
import '@fontsource/instrument-serif/400.css';
import '@fontsource-variable/inter/opsz.css';
import '../../css/site.css';
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

initMenu();
initFeedPage();
