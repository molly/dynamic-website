import express from 'express';
import mongoose from 'mongoose';

import { mergeSocialLinks } from '../../frontend/js/helpers/editorHelpers.js';
import { validateGhostWebhook } from '../helpers/ghostAuth.js';
import { updateTagsOnCreate, updateTagsOnEdit } from '../helpers/tags.js';
import { Book } from '../models/book.model.js';
import { BlockchainEntry, ShortformEntry } from '../models/entry.model.js';
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

router.post(
  '/book',
  authenticated({ redirectTo: '/micro/login' }),
  async function (req, res) {
    try {
      const postToFeed = req.body.postToFeed;
      delete req.body.postToFeed;

      // Update tags (create new ones if necessary, increment usage frequency)
      // Has to happen before the entry is created, or else we don't have the tag IDs to reference
      const tags = await updateTagsOnCreate(req.body.tags, 'micro', true);

      // Make or update book record
      let bookEntry = await Book.find({
        title: req.body.title,
        author: req.body.author,
      });
      let bookEntryId;

      if (!bookEntry.length) {
        // Create new
        bookEntryId = new mongoose.Types.ObjectId();
        bookEntry = await new Book({
          ...req.body,
          tags,
          _id: bookEntryId,
        }).save();
      } else {
        // Update existing
        bookEntryId = bookEntry[0]._id;
        Object.keys(req.body)
          .filter(
            (key) => !['_id', 'createdAt', 'updatedAt', '__v'].includes(key),
          )
          .forEach((key) => {
            if (bookEntry[key] !== req.body[key]) {
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
  } else if (req.params.entryType === 'readingBlockchain') {
    FeedEntryModel = FeedEntryReading;
    ReadingEntryModel = BlockchainEntry;
    category = 'blockchain';
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
