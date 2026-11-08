import sharp from 'sharp';

// Whether an image's edges are white (or transparent), so it would blend into the page without
// a border: screenshots of documents and web pages, mostly. Image blocks with such edges get the
// image tool's "with border" setting when they're added (frontend/js/tools/ImageBlock.js).

const SIZE = 96; // The image is shrunk to this square before its edges are looked at
const RING = 2; // Pixels in from each side
const LIGHT = 236; // Each of red, green and blue at least this: near-white
const SEE_THROUGH = 32; // Alpha below this shows the page behind it
const SHARE = 0.85; // How much of the edge has to be light

/**
 * @param {import('sharp').Sharp} image A sharp instance (a clone, if its input is also going
 *   elsewhere)
 * @returns {Promise<boolean>}
 */
export async function hasLightEdges(image) {
  const { data, info } = await image
    .resize(SIZE, SIZE, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let edge = 0;
  let light = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const onEdge =
        x < RING || y < RING || x >= width - RING || y >= height - RING;
      if (!onEdge) {
        continue;
      }
      const i = (y * width + x) * channels;
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
      edge++;
      if (a < SEE_THROUGH || (r >= LIGHT && g >= LIGHT && b >= LIGHT)) {
        light++;
      }
    }
  }
  return light / edge >= SHARE;
}

/**
 * The same for an image file in memory. Only the first frame of an animation is looked at.
 * @param {Buffer} buffer
 * @returns {Promise<boolean>}
 */
export const bufferHasLightEdges = (buffer) =>
  hasLightEdges(sharp(buffer, { pages: 1 }));
