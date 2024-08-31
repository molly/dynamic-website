import { decode } from 'html-entities';
import fs from 'node:fs';
import pug from 'pug';
import { getRssEntriesFromDb } from '../../api/client.js';
import { getFeedEntries } from '../../api/feed.js';
import { getMicroEntries } from '../../api/micro.js';
import getRssResults from '../../data/filter/rss.js';
import { toISOWithoutMillis } from '../../pug/js/toISO.js';
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
}

export async function generateRssForMicro() {
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
}

export async function generateRssForShortform() {
  const shortform = await getRssEntriesFromDb('shortform');
  const results = await getRssResults(shortform, 'rssArticle');
  const xml = pug.renderFile(
    new URL('../../pug/views/rss/readingRss.pug', import.meta.url).pathname,
    {
      prefix: 'shortform',
      results,
      toISOWithoutMillis,
    },
  );
  writeRssFile('../../rss/shortformFeed.xml', xml);
}

export async function generateRssForBlockchain() {
  const blockchain = await getRssEntriesFromDb('blockchain');
  const results = await getRssResults(blockchain, 'rssArticle');
  const xml = pug.renderFile(
    new URL('../../pug/views/rss/readingRss.pug', import.meta.url).pathname,
    {
      prefix: 'blockchain',
      results,
      toISOWithoutMillis,
    },
  );
  writeRssFile('../../rss/blockchainFeed.xml', xml);
}
