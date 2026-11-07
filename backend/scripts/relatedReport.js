// A report of which entries would be related to which, with their scores, for choosing
// MIN_RELATED_SCORE in api/helpers/relatedScore.js. Changes nothing.
//   node backend/scripts/relatedReport.js [number of recent posts, default 40]
import {
  documentFrequencies,
  rankRelated,
} from '../../api/helpers/relatedScore.js';
import {
  FEED_ENTRY_LABEL_POPULATE,
  labelFeedEntry,
} from '../helpers/feedEntries.js';
import { loadRelatedIndex } from '../helpers/related.js';
import db from '../models/db.js';
import { FeedEntry } from '../models/feed/feedEntry.model.js';
import { Tag } from '../models/tag.model.js';

async function main() {
  await db.initialize();
  const count = Number(process.argv[2]) || 40;
  const index = await loadRelatedIndex();
  const frequencies = documentFrequencies(index);
  const labels = new Map(
    (
      await FeedEntry.find({ _id: { $in: index.map((e) => e._id) } })
        .populate(FEED_ENTRY_LABEL_POPULATE)
        .lean()
    ).map((e) => [String(e._id), labelFeedEntry(e).label]),
  );
  const tagNames = new Map(
    (await Tag.find({}, 'text').lean()).map((t) => [String(t._id), t.text]),
  );
  const posts = index
    .filter((e) => e.__t === 'FeedEntryMicro')
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, count);

  const allScores = [];
  for (const post of posts) {
    const ranked = rankRelated(post, index, frequencies, {
      min: 0.01,
      limit: 5,
    });
    console.log(`\n${labels.get(String(post._id))}`);
    console.log(
      `  tags: ${(post.tags || []).map((t) => tagNames.get(String(t)) || t).join(', ') || '(none)'}`,
    );
    for (const { entry, score } of ranked) {
      allScores.push(score);
      const candidate = index.find((e) => String(e._id) === String(entry));
      const shared = (candidate.tags || [])
        .map(String)
        .filter((t) => (post.tags || []).map(String).includes(t))
        .map((t) => tagNames.get(t))
        .join(', ');
      console.log(
        `  ${score.toFixed(1).padStart(5)}  ${labels.get(String(entry))}  [${shared}]`,
      );
    }
    if (!ranked.length) {
      console.log('  (nothing shared)');
    }
  }
  allScores.sort((a, b) => a - b);
  const at = (p) =>
    allScores[Math.floor((allScores.length - 1) * p)]?.toFixed(1);
  console.log(
    `\nScores of the top 5 per post: min ${at(0)}, 25% ${at(0.25)}, median ${at(0.5)}, 75% ${at(0.75)}, max ${at(1)}`,
  );
  console.log(
    `Entries in the index: ${index.length}; relatedScore weights in api/helpers/relatedScore.js.`,
  );
  process.exit(0);
}

main();
