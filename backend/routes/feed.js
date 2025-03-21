import express from 'express';
import mongoose from 'mongoose';

import { mergeSocialLinks } from '../../frontend/js/helpers/editorHelpers.js';
import { validateGhostWebhook } from '../helpers/ghostAuth.js';
import { updateTagsOnCreate, updateTagsOnEdit } from '../helpers/tags.js';
import { Book } from '../models/book.model.js';
import { ShortformEntry } from '../models/entry.model.js';
import {
  FeedEntryCitationNeeded,
  FeedEntryReading,
} from '../models/feed/feedEntry.model.js';
import { authenticated } from './auth.js';

const router = express.Router();

router.post('/citationNeeded', validateGhostWebhook, async (req, res) => {
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
});

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

// Tagger
router.post('/tags/:entryType', authenticated(), async (req, res) => {
  let FeedEntryModel;
  let ReadingEntryModel;
  let category;
  if (req.params.entryType === 'citationNeeded') {
    FeedEntryModel = FeedEntryCitationNeeded;
    category = 'citationNeeded';
  } else if (req.params.entryType === 'readingShortform') {
    FeedEntryModel = FeedEntryReading;
    ReadingEntryModel = ShortformEntry;
    category = 'shortform';
  }
  const { id, tags, socialLinks } = req.body;
  let tagIds = null;
  const feedEntry = await FeedEntryModel.findById(id);
  if (tags && tags.length) {
    const tagIds = await updateTagsOnEdit(feedEntry.tags, tags, category);
    feedEntry.tags = tagIds;
  }
  if (socialLinks && Object.keys(socialLinks).length) {
    feedEntry.socialLinks = mergeSocialLinks(
      feedEntry.socialLinks,
      socialLinks,
    );
  }
  const resp = await feedEntry.save();
  if (tagIds && ReadingEntryModel) {
    await ReadingEntryModel.findByIdAndUpdate(id, { tags: tagIds });
  }
  res.json(resp);
});

export default router;
