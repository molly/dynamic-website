export const WEBMENTION_USER_AGENT =
  'MollyWhite.net webmentions (https://github.com/molly/dynamic-website)';

export const makeExternalRequestConfig = ({ headers = {} } = {}) => ({
  timeout: 5000,
  maxContentLength: 100000,
  maxRedirects: 5,
  headers: {
    'User-Agent': WEBMENTION_USER_AGENT,
    ...headers,
  },
});
