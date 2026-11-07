import express from 'express';
import mongoose from 'mongoose';

import { isProd } from '../env.js';
import { queueArchive } from '../helpers/archive.js';
import { ENTITY_SUMMARY_FIELDS } from '../helpers/entities.js';
import {
  FEED_ENTRY_LABEL_POPULATE,
  labelFeedEntry,
} from '../helpers/feedEntries.js';
import { refreshRelatedInBackground } from '../helpers/related.js';
import { fetchPostInfo, fetchSocialPost } from '../helpers/socialFetch.js';
import { updateTagsOnCreate, updateTagsOnEdit } from '../helpers/tags.js';
import { Entity } from '../models/entity.model.js';
import { ShortformEntry } from '../models/entry.model.js';
import { FeedEntry, FeedEntryMicro } from '../models/feed/feedEntry.model.js';
import MicroEntry from '../models/micro/microEntry.model.js';
import { Thread } from '../models/thread.model.js';
import { authenticated } from './auth.js';

const router = express.Router();

// Fields the editor has emptied arrive as null; a new entry simply doesn't get them.
const withoutNulls = (fields) =>
  Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null));

// What the editor gets back from every route: the entry, its related posts with titles, and the
// feed entry's threads, about and related entries (which live on the feed entry, not the micro
// entry). Related entries come labelled, in their order, without any since deleted.
async function editorResponse(entry) {
  const [populated, feedEntry] = await Promise.all([
    entry.populate({ path: 'relatedPosts.ref', select: 'title' }),
    FeedEntryMicro.findOne(
      { micro: entry._id },
      'threads about related createdAt',
    )
      .populate({ path: 'threads', model: Thread, select: 'title slug' })
      .populate({
        path: 'about',
        model: Entity,
        select: ENTITY_SUMMARY_FIELDS,
      }),
  ]);
  if (!feedEntry) {
    return { ...populated.toJSON(), feed: null };
  }
  const related = await FeedEntry.find({
    _id: { $in: feedEntry.related },
    deletedAt: null,
  })
    .populate(FEED_ENTRY_LABEL_POPULATE)
    .lean();
  const byId = new Map(related.map((e) => [String(e._id), labelFeedEntry(e)]));
  return {
    ...populated.toJSON(),
    feed: {
      ...feedEntry.toJSON(),
      related: feedEntry.related
        .map((id) => byId.get(String(id)))
        .filter(Boolean),
    },
  };
}

router.post(
  '/entry',
  authenticated({ redirectTo: '/micro/login' }),
  async function (req, res) {
    try {
      const {
        threads = [],
        about = [],
        related = [],
        tags: tagInput,
        ...fields
      } = req.body;
      // Tags first: the entry needs their IDs. Creates new tags and increments usage counts.
      const tags = await updateTagsOnCreate(tagInput, 'micro');

      const microEntryId = new mongoose.Types.ObjectId();
      const entry = new MicroEntry({
        ...withoutNulls(fields),
        tags,
        _id: microEntryId,
      });
      const feedEntry = new FeedEntryMicro({
        micro: microEntryId,
        tags,
        threads,
        about,
        related,
      });
      await Promise.all([entry.save(), feedEntry.save()]);
      refreshRelatedInBackground(feedEntry._id);
      if (isProd) {
        // Archive the new post's own page once it's had a minute to be published everywhere.
        await queueArchive(
          [`https://www.mollywhite.net/micro/entry/${entry.slug}`],
          {
            delay: 60 * 1000,
          },
        );
      }
      res.json(await editorResponse(entry));
    } catch (err) {
      console.log(err);
      res.status(500).send({ error: err });
    }
  },
);

router.post(
  '/entry/:id',
  authenticated({ redirectTo: '/micro/login' }),
  async function (req, res) {
    try {
      const [entry, feedEntry] = await Promise.all([
        MicroEntry.findById(req.params.id),
        FeedEntryMicro.findOne({ micro: req.params.id }),
      ]);
      if (!entry || !feedEntry) {
        res.sendStatus(404);
        return;
      }
      const { threads, about, related, tags: tagInput, ...fields } = req.body;
      const tags = await updateTagsOnEdit(entry.tags, tagInput || [], 'micro');

      Object.keys(fields)
        .filter(
          (key) => !['_id', 'createdAt', 'updatedAt', '__v'].includes(key),
        )
        .forEach((key) => {
          if (fields[key] === null) {
            // The editor sends null for a field it has emptied (no data link, not a reply,
            // not live), which removes it rather than storing null.
            entry.set(key, undefined);
          } else if (entry[key] !== fields[key]) {
            entry[key] = fields[key];
          }
        });
      entry.tags = tags;

      // The feed entry keeps its own copy of the tags, which must follow the post's.
      feedEntry.tags = tags;
      if (threads) {
        feedEntry.threads = threads;
      }
      if (about) {
        feedEntry.about = about;
      }
      if (related) {
        feedEntry.related = related;
      }

      await Promise.all([entry.save(), feedEntry.save()]);
      refreshRelatedInBackground(feedEntry._id);
      res.json(await editorResponse(entry));
    } catch (err) {
      console.log(err);
      res.status(500).send({ error: err });
    }
  },
);

router.delete(
  '/entry/:id',
  authenticated({ redirectTo: '/micro/login' }),
  async function (req, res) {
    const microEntry = await MicroEntry.findById(req.params.id);
    const feedEntry = await FeedEntryMicro.findOne({ micro: req.params.id });
    if (!microEntry) {
      res.sendStatus(404);
      return;
    } else {
      // Decrement tag frequency
      await updateTagsOnEdit(microEntry.tags, [], 'micro');

      // Clear micro entry
      for (let key of [
        'title',
        'post',
        'tags',
        'relatedPosts',
        'socialLinks',
      ]) {
        microEntry[key] = undefined;
      }
      microEntry.deletedAt = new Date();

      // Clear feed entry
      feedEntry.tags = undefined;
      feedEntry.threads = undefined;
      feedEntry.about = undefined;
      feedEntry.deletedAt = new Date();

      await Promise.all([microEntry.save(), feedEntry.save()]);
      res.sendStatus(204);
    }
  },
);

// Get a single entry
router.get('/entry/:slug', async (req, res) => {
  const entry = await MicroEntry.findOne({ slug: req.params.slug });
  if (entry) {
    res.json(await editorResponse(entry));
  } else {
    res.sendStatus(404);
  }
});

// A post that couldn't be fetched: gone (422), the network failed (502), or not a post link (422).
function sendFetchError(res, err) {
  if (err.response?.status === 404) {
    res.status(422).json({
      error: 'That post was not found; it may have been deleted or be private.',
    });
  } else if (err.isAxiosError) {
    res.status(502).json({ error: `Couldn't fetch the post: ${err.message}` });
  } else {
    res.status(422).json({ error: err.message });
  }
}

// Who wrote a Bluesky, Mastodon or Twitter post and when, for "in reply to"
router.get('/replyInfo', authenticated(), async (req, res) => {
  try {
    res.json(await fetchPostInfo(String(req.query.url || '')));
  } catch (err) {
    sendFetchError(res, err);
  }
});

// A Bluesky or Mastodon post as a social post card, with its media copied to the bucket
router.post('/socialPost', authenticated(), async (req, res) => {
  try {
    res.json(await fetchSocialPost(String(req.body.url || '')));
  } catch (err) {
    sendFetchError(res, err);
  }
});

// Get related posts for dropdown
router.get('/relatedPosts', async (req, res) => {
  const results = await ShortformEntry.aggregate([
    { $sort: { entryAdded: -1 } },
    { $limit: 10 },
    {
      $project: {
        sortBy: '$entryAdded',
        title: 1,
        _id: 1,
        type: 'ShortformEntry',
      },
    },
    {
      $unionWith: {
        coll: 'press',
        pipeline: [
          { $sort: { date: -1 } },
          { $limit: 5 },
          {
            $project: { sortBy: '$date', title: 1, _id: 1, type: 'PressEntry' },
          },
        ],
      },
    },
    { $sort: { sortBy: -1 } },
  ]);
  res.json(results);
});

export default router;
