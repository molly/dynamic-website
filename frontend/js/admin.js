import { setupEntityForm } from './admin/entityForm.js';
import { setupThreadForm } from './admin/threadForm.js';

// One bundle for the admin pages; each page says which it is in <body data-page>.
const PAGES = {
  entity: setupEntityForm,
  thread: setupThreadForm,
};

document.addEventListener('DOMContentLoaded', () => {
  const setup = PAGES[document.body.dataset.page];
  const dataElement = document.getElementById('page-data');
  if (setup && dataElement) {
    Promise.resolve(setup(JSON.parse(dataElement.textContent))).catch(
      console.error,
    );
  }
});
