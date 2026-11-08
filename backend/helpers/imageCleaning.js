import sharp from 'sharp';

// Uploaded images are cleaned on their way to the bucket: turned upright, shrunk to at most
// MAX_IMAGE_WIDTH wide (any height, so tall screenshots stay readable), and stripped of their
// metadata (EXIF, including where a photo was taken; sharp drops metadata unless told to keep it).
// The format stays the same.

export const MAX_IMAGE_WIDTH = 2000;

// Formats sharp can read and write. GIFs and WebPs can be animated, and keep their frames.
const CLEANABLE = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/tiff',
]);
const ANIMATED = new Set(['image/gif', 'image/webp']);
// Photo formats sharp can't read, which would otherwise be stored with their location data
const UNCLEANABLE = new Set(['image/heic', 'image/heif']);

const baseType = (contentType) =>
  String(contentType || '')
    .split(';')[0]
    .trim()
    .toLowerCase();

/**
 * A stream that cleans an image of the given type, or null for files that aren't cleaned (videos,
 * SVGs, PDFs and the like, which have no EXIF to strip or which sharp can't handle). Each call
 * makes a new stream: a stream can only carry one file.
 * @param {string} contentType
 * @returns {?import('sharp').Sharp}
 * @throws For photo formats that can't be cleaned (HEIC), rather than store them as they are
 */
export function imageCleaner(contentType) {
  const type = baseType(contentType);
  if (UNCLEANABLE.has(type)) {
    throw new Error(
      'HEIC images can’t be cleaned of their location data here. Export or save the photo as a JPEG and upload that.',
    );
  }
  if (!CLEANABLE.has(type)) {
    return null;
  }
  return (
    sharp({ animated: ANIMATED.has(type) })
      // Apply the EXIF orientation to the pixels before the EXIF is dropped, or phone photos turn
      // sideways
      .rotate()
      .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
  );
}

// Cleaning images already in the bucket (backend/scripts/cleanBucketImages.js) --------------------

/**
 * Which identifying metadata an image has, from sharp's metadata(): EXIF (which holds GPS
 * location and camera details), XMP, IPTC and PNG text comments. (sharp doesn't report JPEG
 * comment segments; stripJpegMetadata removes them along with the rest.) An ICC color profile doesn't
 * count; it describes colors, not the photo or who took it.
 * @param {import('sharp').Metadata} meta
 * @returns {string[]}
 */
export function identifyingMetadata(meta) {
  return [
    meta.exif && 'EXIF',
    meta.xmp && 'XMP',
    meta.iptc && 'IPTC',
    meta.comments?.length && 'comments',
  ].filter(Boolean);
}

// JPEG segments that hold metadata rather than the picture: APP1 (EXIF, XMP), APP3–APP13 (camera
// makers' data, IPTC in APP13), APP15 and comments. APP0 (JFIF), APP2 (the ICC color profile) and
// APP14 (Adobe's color transform, needed to decode some files) are kept.
const isMetadataSegment = (marker) =>
  marker === 0xe1 ||
  (marker >= 0xe3 && marker <= 0xed) ||
  marker === 0xef ||
  marker === 0xfe;

/**
 * A JPEG with its metadata segments cut out, without re-encoding the picture, so there's no loss
 * of quality. Only for JPEGs that don't depend on EXIF orientation: once the EXIF is gone, the
 * picture shows as stored.
 * @param {Buffer} input
 * @returns {Buffer}
 * @throws If it isn't a well-formed JPEG
 */
export function stripJpegMetadata(input) {
  if (input[0] !== 0xff || input[1] !== 0xd8) {
    throw new Error('Not a JPEG');
  }
  const parts = [input.subarray(0, 2)];
  let i = 2;
  while (i < input.length) {
    if (input[i] !== 0xff) {
      throw new Error('Malformed JPEG');
    }
    while (input[i + 1] === 0xff) {
      i++; // Fill bytes before a marker
    }
    const marker = input[i + 1];
    if (marker === 0xda || marker === 0xd9) {
      // Start of the image data (or the end of the file): the rest is the picture, as it is
      parts.push(input.subarray(i));
      return Buffer.concat(parts);
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      parts.push(input.subarray(i, i + 2)); // Markers with no length or data
      i += 2;
      continue;
    }
    if (i + 4 > input.length) {
      throw new Error('Malformed JPEG');
    }
    const end = i + 2 + input.readUInt16BE(i + 2);
    if (end > input.length) {
      throw new Error('Malformed JPEG');
    }
    if (!isMetadataSegment(marker)) {
      parts.push(input.subarray(i, end));
    }
    i = end;
  }
  throw new Error('Malformed JPEG: no image data');
}

const REENCODE = {
  jpeg: (image) => image.jpeg({ quality: 92 }),
  webp: (image) => image.webp({ quality: 92 }),
  png: (image) => image.png(),
  gif: (image) => image.gif(),
  avif: (image) => image.avif({ quality: 80 }),
  tiff: (image) => image.tiff(),
};

/**
 * An image already in the bucket with its identifying metadata removed, at the same size and in
 * the same format. JPEGs that don't need turning upright are stripped without re-encoding; others
 * are turned upright (from their EXIF orientation) and re-encoded at high quality, keeping their
 * color profile.
 * @param {Buffer} input
 * @returns {Promise<{output: Buffer, removed: string[], reencoded: boolean}|null>} Null if it has
 *   nothing to remove
 * @throws For formats it can't rewrite, or if metadata is somehow left behind
 */
export async function stripStoredImage(input) {
  const meta = await sharp(input).metadata();
  const removed = identifyingMetadata(meta);
  if (!removed.length) {
    return null;
  }
  const upright = !meta.orientation || meta.orientation === 1;
  let output;
  let reencoded = false;
  if (meta.format === 'jpeg' && upright) {
    output = stripJpegMetadata(input);
  } else {
    const reencode = REENCODE[meta.format];
    if (!reencode) {
      throw new Error(`Can’t rewrite ${meta.format} images`);
    }
    output = await reencode(
      sharp(input, { animated: (meta.pages || 1) > 1 })
        .rotate()
        .keepIccProfile(),
    ).toBuffer();
    reencoded = true;
  }
  const left = identifyingMetadata(await sharp(output).metadata());
  if (left.length) {
    throw new Error(`Still has ${left.join(', ')} after cleaning`);
  }
  return { output, removed, reencoded };
}
