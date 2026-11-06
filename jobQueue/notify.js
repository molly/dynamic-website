import axios from 'axios';
import auth from '../backend/config/auth.config.js';

// Send a push notification via ntfy. Requires `ntfyUrl` (the full topic URL,
// e.g. https://ntfy.example.com/webmentions) in auth.config.js; `ntfyToken`
// is optional, for servers/topics that require auth.
// Returns false (without throwing) if ntfy isn't configured.
export const sendNotification = async ({ title, message, click, tags }) => {
  if (!auth.ntfyUrl) {
    console.warn('ntfyUrl is not configured; skipping notification:', title);
    return false;
  }
  const headers = { 'Content-Type': 'text/plain' };
  if (title) {
    headers.Title = title;
  }
  if (click) {
    headers.Click = click;
  }
  if (tags) {
    headers.Tags = tags.join(',');
  }
  if (auth.ntfyToken) {
    headers.Authorization = `Bearer ${auth.ntfyToken}`;
  }
  await axios.post(auth.ntfyUrl, message, { headers, timeout: 10000 });
  return true;
};
