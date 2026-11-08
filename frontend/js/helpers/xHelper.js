// The local helper that posts to and fetches from x.com in a browser on this computer, since
// Twitter has no free API (see backend/scripts/xComposeHelper.js; run it with `npm run x-helper`).
export const X_HELPER_URL = 'http://localhost:5055';

export const X_HELPER_UNREACHABLE = `Couldn't reach the X helper at ${X_HELPER_URL}. Is \`npm run x-helper\` running on this computer?`;
