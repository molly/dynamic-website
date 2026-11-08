import axios from 'axios';
import { showStatus } from './formHelpers.js';

export function setupThreadForm({ thread, entryCount }) {
  const form = document.getElementById('thread-form');
  const error = form.querySelector('.entity-error');
  const status = form.querySelector('.admin-status');

  form.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    error.hidden = true;
    try {
      const { data } = await axios.put(`/dynamic-api/threads/${thread._id}`, {
        title: document.getElementById('thread-title').value,
        description: document.getElementById('thread-description').value,
      });
      document.querySelector('h1').textContent =
        data.title || 'Untitled thread';
      showStatus(status, 'Saved.');
    } catch (err) {
      error.textContent = err.response?.data?.error || err.message;
      error.hidden = false;
    }
  });

  setupDelete(thread, entryCount);
}

// Deleting the thread: its entries stay, out of it
function setupDelete(thread, entryCount) {
  const error = document.getElementById('thread-delete-error');
  document
    .getElementById('thread-delete')
    .addEventListener('click', async () => {
      error.hidden = true;
      const name = thread.title ? `“${thread.title}”` : 'this untitled thread';
      const entries = entryCount
        ? `\n\n${entryCount === 1 ? 'Its entry stays' : `Its ${entryCount} entries stay`}, just no longer in this thread.`
        : '';
      if (
        !window.confirm(`Delete ${name}?${entries}\n\nThis can't be undone.`)
      ) {
        return;
      }
      try {
        await axios.delete(`/dynamic-api/threads/${thread._id}`);
        window.location.href = '/admin/threads';
      } catch (err) {
        error.textContent = err.response?.data?.error || err.message;
        error.hidden = false;
      }
    });
}
