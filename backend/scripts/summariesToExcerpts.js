/**
 * Move reading entries' summaries into excerpts. The summary field used to hold the passages you
 * quoted from an article; they now go in `excerpts` (plain text, one passage each: see
 * api/helpers/summaryExcerpts.js), and `summary` is for your own commentary.
 *
 *   node backend/scripts/summariesToExcerpts.js --since 2022-01-01                 # dry run
 *   node backend/scripts/summariesToExcerpts.js --since 2022-01-01 --keep id1,id2  # leave these
 *   node backend/scripts/summariesToExcerpts.js --since 2022-01-01 --apply [--keep …]
 *
 * --since: only entries read (started) on or after this date. Earlier summaries were mostly your
 * own write-ups ("Salaks writes about…"), so they stay summaries.
 *
 * The dry run lists every change, with each entry's ID for --keep. An entry that already has
 * excerpts is skipped. Italics, links and lists in a summary become plain text.
 */
import { summaryToExcerpts } from '../../api/helpers/summaryExcerpts.js';
import db from '../models/db.js';

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const keepArg = args[args.indexOf('--keep') + 1];
  const keep = new Set(
    args.includes('--keep') && keepArg
      ? keepArg.split(',').map((id) => id.trim())
      : [],
  );
  // `started` is stored as text (YYYY, YYYY-MM or YYYY-MM-DD), which sorts by date
  const since = args.includes('--since')
    ? args[args.indexOf('--since') + 1]
    : null;
  if (since !== null && !/^\d{4}(-\d{2}){0,2}$/.test(since || '')) {
    throw new Error(`--since "${since}" isn't a date (use YYYY-MM-DD).`);
  }
  await db.initialize();
  const collection = db.connection.collection('shortform');
  const entries = await collection
    .find(
      {
        summary: { $nin: [null, ''] },
        ...(since ? { started: { $gte: since } } : {}),
      },
      { projection: { title: 1, summary: 1, excerpts: 1 } },
    )
    .toArray();

  let moved = 0;
  let kept = 0;
  let skipped = 0;
  for (const entry of entries) {
    const id = String(entry._id);
    if (keep.has(id)) {
      kept++;
      continue;
    }
    if (entry.excerpts?.length) {
      skipped++;
      console.log(`· ${entry.title} (${id}) already has excerpts; skipped`);
      continue;
    }
    const excerpts = summaryToExcerpts(entry.summary);
    if (!excerpts.length) {
      skipped++;
      continue;
    }
    moved++;
    if (!apply) {
      console.log(
        `${entry.title} (${id})\n${excerpts.map((e) => `  + ${e.slice(0, 140)}${e.length > 140 ? '…' : ''}`).join('\n')}`,
      );
    } else {
      await collection.updateOne(
        { _id: entry._id },
        { $set: { excerpts }, $unset: { summary: '' } },
      );
    }
  }

  console.log(
    `\n${moved} ${apply ? 'moved' : 'to move (add --apply to move them)'}${kept ? `, ${kept} kept as summaries` : ''}${skipped ? `, ${skipped} skipped` : ''}.`,
  );
  await db.gracefulClose();
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
  await db.gracefulClose();
});
