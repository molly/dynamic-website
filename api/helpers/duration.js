/**
 * A typed length in seconds: "52:30" and "1:02:30" are minutes:seconds and hours:minutes:seconds;
 * a bare number is minutes. Blank is null; anything else is NaN.
 * @param {string} text
 * @returns {?number}
 */
export function parseDuration(text) {
  const value = String(text ?? '').trim();
  if (!value) {
    return null;
  }
  if (/^\d+(\.\d+)?$/.test(value)) {
    return Math.round(Number(value) * 60);
  }
  if (!/^\d+(:[0-5]\d){1,2}$/.test(value)) {
    return NaN;
  }
  return value.split(':').reduce((total, part) => total * 60 + Number(part), 0);
}
