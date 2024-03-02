import express from 'express';
import { getFeedEntries } from '../../api/feed.js';
import {
  BlockchainEntry,
  ShortformEntry,
} from '../../backend/models/entry.model.js';
import {
  FeedEntryCitationNeeded,
  FeedEntryReading,
} from '../../backend/models/feed/feedEntry.model.js';
import { Tag } from '../../backend/models/tag.model.js';
import { authenticated } from '../../backend/routes/auth.js';
import { sanitizeTag } from '../js/helpers/sanitize.js';

const router = express.Router();

router.get('/', async function (req, res) {
  const entries = await getFeedEntries();
  res.render('feed/index.pug', {
    entries,
    options: { isInFeed: true, isLoggedIn: req.isAuthenticated() },
  });
});

// Tag feed
router.get('/tag/:tag', async (req, res) => {
  const sanitizedTag = sanitizeTag(req.params.tag);
  const tag = await Tag.findOne({ value: sanitizedTag });
  let hasResults = false;
  let entries = [];
  if (tag) {
    hasResults = true;
    entries = await getFeedEntries({ tags: tag._id });
  }
  res.render('feed/index.pug', {
    entries,
    options: {
      isLoggedIn: req.isAuthenticated(),
      tag: tag,
      tagQuery: sanitizedTag,
      hasResults,
    },
  });
});

// Tag editor
router.get(
  '/tagger/:type/:id',
  authenticated({ redirectTo: '/micro/login' }),
  async (req, res) => {
    const entryType = req.params.type;
    const entryId = req.params.id;
    let entry;
    if (entryType === 'micro') {
      res.status(400).send('Use the micro editor.');
    } else if (entryType === 'citationNeeded') {
      entry = await FeedEntryCitationNeeded.findById(entryId).populate({
        path: 'tags',
        model: Tag,
      });
      res.render('feed/tagger.pug', { entry, entryType: 'citationNeeded' });
    } else if (
      entryType === 'readingShortform' ||
      entryType === 'readingBlockchain'
    ) {
      entry = await FeedEntryReading.findById(entryId)
        .populate({
          path: 'tags',
          model: Tag,
          options: { sort: { value: 1 } },
        })
        .populate({
          path: 'shortform',
          model: ShortformEntry,
        })
        .populate({ path: 'blockchain', model: BlockchainEntry });
      res.render('feed/tagger.pug', { entry, entryType });
    } else {
      res.statusCode(400);
    }
  },
);

export default router;
