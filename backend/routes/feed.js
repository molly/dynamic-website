import express from 'express';

import { mergeSocialLinks } from '../../frontend/js/helpers/editorHelpers.js';
import { updateTagsOnEdit } from '../helpers/tags.js';
import { BlockchainEntry, ShortformEntry } from '../models/entry.model.js';
import {
  FeedEntryCitationNeeded,
  FeedEntryReading,
} from '../models/feed/feedEntry.model.js';
import { authenticated } from './auth.js';

const router = express.Router();

router.post('/citationNeeded', async (req, res) => {
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
