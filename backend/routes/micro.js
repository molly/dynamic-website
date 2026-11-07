import express from 'express';
import mongoose from 'mongoose';

import { isProd } from '../env.js';
import { queueArchive } from '../helpers/archive.js';
import { ENTITY_SUMMARY_FIELDS } from '../helpers/entities.js';
import { fetchPostInfo } from '../helpers/socialFetch.js';
import { updateTagsOnCreate, updateTagsOnEdit } from '../helpers/tags.js';
import { Entity } from '../models/entity.model.js';
import { ShortformEntry } from '../models/entry.model.js';
import { FeedEntryMicro } from '../models/feed/feedEntry.model.js';
import MicroEntry from '../models/micro/microEntry.model.js';
import { Thread } from '../models/thread.model.js';
import { authenticated } from './auth.js';

const router = express.Router();

// Fields the editor has emptied arrive as null; a new entry simply doesn't get them.
const withoutNulls = (fields) =>
  Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null));

// What the editor gets back from every route: the entry, its related posts with titles, and the
// feed entry's threads and about (which live on the feed entry, not the micro entry).
async function editorResponse(entry) {
  const [populated, feedEntry] = await Promise.all([
    entry.populate({ path: 'relatedPosts.ref', select: 'title' }),
    FeedEntryMicro.findOne({ micro: entry._id }, 'threads about createdAt')
      .populate({ path: 'threads', model: Thread, select: 'title slug' })
      .populate({
        path: 'about',
        model: Entity,
        select: ENTITY_SUMMARY_FIELDS,
      }),
  ]);
  return { ...populated.toJSON(), feed: feedEntry ? feedEntry.toJSON() : null };
}

router.post(
  '/entry',
  authenticated({ redirectTo: '/micro/login' }),
  async function (req, res) {
    try {
      const { threads = [], about = [], tags: tagInput, ...fields } = req.body;
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
      });
      await Promise.all([entry.save(), feedEntry.save()]);
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
      const { threads, about, tags: tagInput, ...fields } = req.body;
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

      await Promise.all([entry.save(), feedEntry.save()]);
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

// Who wrote a Bluesky, Mastodon or Twitter post and when, for "in reply to"
router.get('/replyInfo', authenticated(), async (req, res) => {
  try {
    res.json(await fetchPostInfo(String(req.query.url || '')));
  } catch (err) {
    if (err.response?.status === 404) {
      res.status(422).json({
        error:
          'That post was not found; it may have been deleted or be private.',
      });
    } else if (err.isAxiosError) {
      res
        .status(502)
        .json({ error: `Couldn't fetch the post: ${err.message}` });
    } else {
      res.status(422).json({ error: err.message }); // Not a post link
    }
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
