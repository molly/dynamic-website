/**
 * Strip identifying metadata (EXIF, including GPS location; XMP; IPTC; comments) from images
 * already in the storage bucket. Uploads have been cleaned as they come in since the image
 * cleaner was restored (backend/helpers/imageCleaning.js); this is for the ones before that.
 *
 *   node backend/scripts/cleanBucketImages.js                 # dry run: list what would change
 *   node backend/scripts/cleanBucketImages.js --apply         # clean them
 *
 * Options:
 *   --folder <prefix>  Bucket folder to clean (default: micro, the live site's uploads; dev
 *                      uploads are in dev/micro)
 *   --backup <dir>     Where to save each original before it's replaced (default:
 *                      ~/bucket-image-backups/<date>). Kept off the repo and the bucket, since the
 *                      originals hold the location data being removed.
 *   --limit <n>        Stop after cleaning this many (to try it on a few first)
 *
 * Files keep their names, so links to them keep working, and their size and format. Images with
 * nothing to remove (including media copied from Bluesky, Mastodon and Twitter, which those
 * platforms already strip) are left alone. JPEGs are stripped without re-encoding unless they
 * need turning upright. A file that changes in the bucket while this runs isn't overwritten.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { uploadBucket } from '../helpers/bucket.js';
import { stripStoredImage } from '../helpers/imageCleaning.js';

const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/tiff',
]);

function parseArgs(argv) {
  const options = {
    apply: false,
    folder: 'micro',
    backup: path.join(
      os.homedir(),
      'bucket-image-backups',
      new Date().toISOString().slice(0, 10),
    ),
    limit: Infinity,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply') {
      options.apply = true;
    } else if (arg === '--folder') {
      options.folder = argv[++i].replace(/\/+$/, '');
    } else if (arg === '--backup') {
      options.backup = path.resolve(argv[++i]);
    } else if (arg === '--limit') {
      options.limit = Number(argv[++i]);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;

async function main() {
  const options = parseArgs(process.argv.slice(2));
  console.log(
    `${options.apply ? 'Cleaning' : 'Dry run (add --apply to clean)'}: ${options.folder}/ in ${uploadBucket.name}`,
  );
  if (options.apply) {
    await fs.mkdir(options.backup, { recursive: true });
    console.log(`Originals are saved to ${options.backup}`);
  }

  const counts = { files: 0, images: 0, clean: 0, cleaned: 0, failed: 0 };
  // The trailing slash keeps "micro" from also matching "micro-something/"
  const [files] = await uploadBucket.getFiles({ prefix: `${options.folder}/` });
  for (const file of files) {
    if (counts.cleaned >= options.limit) {
      break;
    }
    counts.files++;
    const contentType = String(file.metadata.contentType || '')
      .split(';')[0]
      .trim()
      .toLowerCase();
    if (!IMAGE_TYPES.has(contentType)) {
      continue;
    }
    counts.images++;
    try {
      const [original] = await file.download();
      const result = await stripStoredImage(original);
      if (!result) {
        counts.clean++;
        continue;
      }
      const how = result.reencoded ? 're-encoded' : 'stripped losslessly';
      const sizes = `${kb(original.length)} → ${kb(result.output.length)}`;
      if (!options.apply) {
        console.log(
          `would clean ${file.name}: ${result.removed.join(', ')} (${how}, ${sizes})`,
        );
        counts.cleaned++;
        continue;
      }
      await fs.writeFile(
        path.join(options.backup, file.name.replace(/\//g, '__')),
        original,
      );
      await file.save(result.output, {
        resumable: false,
        predefinedAcl: 'private', // As uploads are stored (backend/routes/images.js)
        metadata: {
          contentType: file.metadata.contentType,
          ...(file.metadata.cacheControl
            ? { cacheControl: file.metadata.cacheControl }
            : {}),
        },
        // Only if nobody has replaced the file since it was listed
        preconditionOpts: { ifGenerationMatch: file.metadata.generation },
      });
      console.log(
        `cleaned ${file.name}: ${result.removed.join(', ')} (${how}, ${sizes})`,
      );
      counts.cleaned++;
    } catch (err) {
      counts.failed++;
      console.error(`FAILED ${file.name}: ${err.message}`);
    }
  }

  console.log(
    `\n${counts.files} files, ${counts.images} images: ${counts.cleaned} ${options.apply ? 'cleaned' : 'to clean'}, ${counts.clean} already clean, ${counts.failed} failed.`,
  );
  if (counts.failed) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
