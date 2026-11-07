import express from 'express';
import mongoose from 'mongoose';

import { mergeSocialLinks } from '../../frontend/js/helpers/editorHelpers.js';
import {
  FEED_ENTRY_LABEL_POPULATE,
  labelFeedEntry,
  populateTaggerFields,
} from '../helpers/feedEntries.js';
import { updateTagsOnCreate, updateTagsOnEdit } from '../helpers/tags.js';
import { Book } from '../models/book.model.js';
import { PressEntry, ShortformEntry } from '../models/entry.model.js';
import {
  FeedEntry,
  FeedEntryCitationNeeded,
  FeedEntryPress,
  FeedEntryReading,
} from '../models/feed/feedEntry.model.js';
import MicroEntry from '../models/micro/microEntry.model.js';
import logger from '../winston.js';
import { authenticated } from './auth.js';

const router = express.Router();

// Search my own posts and Citation Needed issues, newest first, for picking what a press piece
// drew on. With no query, the most recent ones.
router.get('/entries/search', authenticated(), async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    let filter = {
      __t: { $in: ['FeedEntryMicro', 'FeedEntryCitationNeeded'] },
    };
    if (query) {
      const pattern = new RegExp(
        query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i',
      );
      const micro = await MicroEntry.find(
        { $or: [{ title: pattern }, { 'post.blocks.data.text': pattern }] },
        '_id',
      )
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      filter = {
        $or: [
          { __t: 'FeedEntryCitationNeeded', title: pattern },
          { __t: 'FeedEntryMicro', micro: { $in: micro.map((m) => m._id) } },
        ],
      };
    }
    const entries = await FeedEntry.find({ ...filter, deletedAt: null })
      .sort({ createdAt: -1 })
      .limit(10)
      .populate(FEED_ENTRY_LABEL_POPULATE)
      .lean();
    res.json(entries.map(labelFeedEntry));
  } catch (err) {
    logger.error('Feed entry search failed', err);
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/citationNeeded',
  /*validateGhostWebhook,*/ async (req, res) => {
    try {
      const { post } = req.body;
      const result = await new FeedEntryCitationNeeded({
        entryType: 'citationNeeded',
        title: post.current.title,
        slug: post.current.slug,
        excerpt: `<p>${post.current.excerpt}</p>`,
        image: post.current.feature_image,
        imageAlt: post.current.feature_image_alt,
      }).save();
      res.json(result);
    } catch (err) {
      console.error(err);
      res.status(500).send({ error: err });
    }
  },
);

router.get('/book', async (req, res) => {
  try {
    const { title, author } = req.query;

    // Necessary for books where translators/etc. are listed as authors
    let firstAuthor = author;
    if (author.includes(',')) {
      firstAuthor = author.split(',')[0].trim();
    }

    const bookEntry = await Book.findOne({
      title: title,
      author: { $regex: firstAuthor },
    });
    if (bookEntry) {
      res.json(bookEntry);
    } else {
      res.status(404).send({ error: 'Book not found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: err });
  }
});

router.post(
  '/book',
  authenticated({ redirectTo: '/micro/login' }),
  async function (req, res) {
    try {
      const postToFeed = req.body.postToFeed;
      delete req.body.postToFeed;

      if (req.body.tags && req.body.tags.length) {
        // Update tags (create new ones if necessary, increment usage frequency)
        // Has to happen before the entry is created, or else we don't have the tag IDs to reference
      }

      // Make or update book record
      let bookEntries = await Book.find({
        title: req.body.title,
        author: req.body.author,
      });
      let bookEntry;
      let bookEntryId;
      let tags = [];
      if (!bookEntries.length) {
        // Create new
        bookEntryId = new mongoose.Types.ObjectId();
        if (req.body.tags && req.body.tags.length) {
          tags = await updateTagsOnCreate(req.body.tags, 'book', true);
        }
        bookEntry = await new Book({
          ...req.body,
          tags,
          _id: bookEntryId,
        }).save();
      } else {
        // Update existing
        bookEntry = bookEntries[0];
        bookEntryId = bookEntry._id;
        if (req.body.tags && req.body.tags.length) {
          tags = await updateTagsOnEdit(
            bookEntry.tags,
            req.body.tags,
            'book',
            true,
          );
        }
        Object.keys(req.body)
          .filter(
            (key) => !['_id', 'createdAt', 'updatedAt', '__v'].includes(key),
          )
          .forEach((key) => {
            if (
              (Array.isArray(req.body[key]) && req.body[key].length > 0) || // Don't erase arrays if the new array is empty
              bookEntry[key] !== req.body[key]
            ) {
              bookEntry[key] = req.body[key];
            }
          });
        await bookEntry.save();
      }

      // Add entry to feed
      let feedEntry;
      if (postToFeed) {
        feedEntry = await new FeedEntryReading({
          book: bookEntryId,
          status: req.body.status,
          tags,
        }).save();
      }

      res.json([bookEntry, feedEntry]);
    } catch (err) {
      console.log(err);
      res.status(500).send({ error: err });
    }
  },
);

router.post(
  '/bookUpdate',
  authenticated({ redirectTo: '/micro/login' }),
  async function (req, res) {
    try {
      const postToFeed = req.body.postToFeed;
      delete req.body.postToFeed;

      // Get book record
      let bookEntryId = req.body._id;
      let bookEntry = await Book.findById(bookEntryId);
      if (!bookEntry) {
        res.status(404).send({ error: 'Book not found' });
        return;
      }
      ['status', 'completed'].forEach((key) => {
        bookEntry[key] = req.body[key];
      });
      await bookEntry.save();

      // Add entry to feed
      let feedEntry;
      if (postToFeed) {
        feedEntry = await new FeedEntryReading({
          book: bookEntryId,
          status: req.body.status,
          tags: bookEntry.tags,
        }).save();
      }

      res.json([bookEntry, feedEntry]);
    } catch (err) {
      console.log(err);
      res.status(500).send({ error: err });
    }
  },
);

// Metadata for feed entries that aren't edited in the micro editor (tagger page).
const TAGGER_TYPES = {
  citationNeeded: {
    model: FeedEntryCitationNeeded,
    category: 'citationNeeded',
  },
  readingShortform: {
    model: FeedEntryReading,
    category: 'shortform',
    // The shortform entry keeps its own copy of the tags.
    content: { path: 'shortform', model: ShortformEntry },
  },
  press: {
    model: FeedEntryPress,
    category: 'press',
    content: { path: 'press', model: PressEntry },
  },
};

router.post('/meta/:entryType', authenticated(), async (req, res) => {
  const config = TAGGER_TYPES[req.params.entryType];
  if (!config) {
    res
      .status(400)
      .send({ error: `Unknown entry type "${req.params.entryType}".` });
    return;
  }
  try {
    const { id, tags = [], threads = [], about = [], socialLinks } = req.body;
    const feedEntry = await config.model.findById(id);
    if (!feedEntry) {
      res.sendStatus(404);
      return;
    }
    const tagIds = await updateTagsOnEdit(
      feedEntry.tags,
      tags,
      config.category,
    );
    feedEntry.tags = tagIds;
    feedEntry.threads = threads;
    feedEntry.about = about;
    if (socialLinks && socialLinks.length) {
      feedEntry.socialLinks = mergeSocialLinks(
        feedEntry.socialLinks,
        socialLinks,
      );
    }
    await feedEntry.save();
    if (config.content) {
      await config.content.model.findByIdAndUpdate(
        feedEntry[config.content.path],
        { tags: tagIds },
      );
    }
    res.json(await populateTaggerFields(feedEntry));
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: err.message });
  }
});

export default router;
