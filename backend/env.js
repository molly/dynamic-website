// The site is live only when started with `node index.js prod`. Everything else (local
// development, scripts) is dev, and must not reach live services: no outbound webmentions, no
// cross-posting, and uploads go to a separate folder in the bucket.
export const isProd = process.argv[2] === 'prod';
