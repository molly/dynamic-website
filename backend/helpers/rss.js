import { decode } from 'html-entities';
import fs from 'node:fs';
import pug from 'pug';
import { getRssReadingFromDb } from '../../api/client.js';
import { getFeedEntries } from '../../api/feed.js';
import { getMicroEntries } from '../../api/micro.js';
import getRssResults from '../../data/filter/rss.js';
import { toISOWithoutMillis } from '../../pug/js/toISO.js';
import { ShortformEntry } from '../models/entry.model.js';
import { FeedEntry } from '../models/feed/feedEntry.model.js';
import MicroEntry from '../models/micro/microEntry.model.js';

// Checks that the directory exists and then writes the file
function writeRssFile(path, xml) {
  const dir = new URL('../../rss', import.meta.url).pathname;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
  fs.writeFileSync(new URL(path, import.meta.url).pathname, xml);
}

function hasImage(entry) {
  if (entry.entryType === 'micro') {
    const firstImage = entry.micro.post.blocks.find(
      (block) => block.type === 'image',
    );
    return !!firstImage;
  } else if (entry.entryType === 'citationNeeded' && entry.image) {
    return true;
  }
  return false;
}

export async function generateRssForFeed() {
  try {
    const { entries } = await getFeedEntries({ limit: 20 });
    const lastUpdated = await FeedEntry.find({}, 'updatedAt')
      .sort({ updatedAt: -1 })
      .limit(1)
      .lean();

    const compiledPug = pug.compileFile(
      new URL('../../pug/views/rss/feedEntry.pug', import.meta.url).pathname,
    );
    for (let entry of entries) {
      entry.html = decode(
        compiledPug({
          entry,
          options: { isRss: true, hasImage: hasImage(entry) },
          toISOWithoutMillis,
        }),
      );
    }

    const xml = pug.renderFile(
      new URL('../../pug/views/rss/feedRss.pug', import.meta.url).pathname,
      {
        path: 'feed',
        title: "Molly White's activity feed",
        lastUpdated: lastUpdated[0].updatedAt,
        entries,
        toISOWithoutMillis,
      },
    );
    writeRssFile('../../rss/feedFeed.xml', xml);
  } catch (err) {
    console.error('Error in generateRssForFeed', err);
  }
}

export async function generateRssForMicro() {
  try {
    const { entries } = await getMicroEntries({ limit: 20 });
    const lastUpdated = await MicroEntry.find({}, 'updatedAt')
      .sort({ updatedAt: -1 })
      .limit(1)
      .lean();

    const compiledPug = pug.compileFile(
      new URL('../../pug/views/rss/microEntry.pug', import.meta.url).pathname,
    );
    for (let entry of entries) {
      entry.__t = 'MicroEntry';
      entry.html = compiledPug({
        entry,
        options: { isRss: true, hasImage: hasImage(entry) },
        toISOWithoutMillis,
      });
    }

    const xml = pug.renderFile(
      new URL('../../pug/views/rss/feedRss.pug', import.meta.url).pathname,
      {
        path: '/micro',
        title: "Molly White's microblog feed",
        lastUpdated: lastUpdated[0].updatedAt,
        entries,
        toISOWithoutMillis,
      },
    );

    writeRssFile('../../rss/microFeed.xml', xml);
  } catch (err) {
    console.error('Error in generateRssForMicro', err);
  }
}

export async function generateRssForReading() {
  try {
    const lastUpdated = await ShortformEntry.aggregate([
      { $match: { updatedAt: { $ne: null } } }, // Filter out shortform entries without an updatedAt
      { $project: { updatedAt: 1 } },
      {
        $unionWith: {
          coll: 'books',
          pipeline: [{ $project: { updatedAt: 1 } }],
        },
      },
      { $sort: { updatedAt: -1 } }, // Sort by updatedAt (descending)
      { $limit: 1 }, // Get the most recent one
    ]);

    const entries = await getRssReadingFromDb();
    const results = await getRssResults(entries, 'rssArticle');
    const xml = pug.renderFile(
      new URL('../../pug/views/rss/readingRss.pug', import.meta.url).pathname,
      {
        prefix: 'shortform',
        results,
        lastUpdated: lastUpdated[0].updatedAt,
        toISOWithoutMillis,
      },
    );
    writeRssFile('../../rss/readingFeed.xml', xml);
  } catch (err) {
    console.error('Error in generateRssForReading', err);
  }
}
