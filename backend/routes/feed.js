import express from 'express';

import { validateGhostWebhook } from '../helpers/ghostAuth.js';
import { updateTagsOnEdit } from '../helpers/tags.js';
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
    console.log(err);
    res.status(500).send({ error: err });
  }
});

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
  const { id, tags } = req.body;
  const feedEntry = await FeedEntryModel.findById(id);
  const tagIds = await updateTagsOnEdit(feedEntry.tags, tags, category);
  feedEntry.tags = tagIds;
  const resp = await feedEntry.save();
  if (ReadingEntryModel) {
    await ReadingEntryModel.findByIdAndUpdate(id, { tags: tagIds });
  }
  res.json(resp);
});

export default router;
