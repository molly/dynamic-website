import axios from 'axios';
import { showStatus } from './formHelpers.js';

export function setupThreadForm({ thread }) {
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
}
