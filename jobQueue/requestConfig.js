export const WEBMENTION_USER_AGENT =
  'MollyWhite.net webmentions (https://github.com/molly/dynamic-website)';

export const makeExternalRequestConfig = ({ headers = {} } = {}) => ({
  timeout: 5000,
  // Many ordinary blog/social pages exceed 100KB of HTML; cap at 5MB
  maxContentLength: 5 * 1024 * 1024,
  maxRedirects: 5,
  headers: {
    'User-Agent': WEBMENTION_USER_AGENT,
    ...headers,
  },
});
