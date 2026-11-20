// Document blocks link to the document itself, which may be a PDF, a web page (an SEC filing's
// .htm) or anything else. Shared by the site's rendering (sourceBlocks.js) and the editor
// (sources.js), so it has no dependencies.

/**
 * Whether a link is to a PDF, going by the end of its path ("….pdf").
 * @param {?string} url
 */
export function isPdfUrl(url) {
  try {
    return /\.pdf$/i.test(new URL(url).pathname);
  } catch {
    return false;
  }
}
