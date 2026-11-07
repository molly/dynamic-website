import express from 'express';
import { queueArchive } from '../helpers/archive.js';
import { addOutletDomain, outletForUrl } from '../helpers/outlets.js';
import { SHORTFORM_CARD_FIELDS } from '../helpers/postContext.js';
import { updateTagsOnCreate } from '../helpers/tags.js';
import { PressEntry, ShortformEntry } from '../models/entry.model.js';
import {
  FeedEntryPress,
  FeedEntryReading,
} from '../models/feed/feedEntry.model.js';
import { BookTag, Tag } from '../models/tag.model.js';
import logger from '../winston.js';
import { authenticated } from './auth.js';

const router = express.Router();

const models = {
  press: PressEntry,
  shortform: ShortformEntry,
};

router.get('/tags', async (_, res) => {
  const tags = await Tag.find({}, { __v: 0 }).lean();
  res.send(tags);
});

router.get('/bookTags', async (_, res) => {
  const bookTags = await BookTag.find({}, { __v: 0 }).lean();
  res.send(bookTags);
});

// Search shortform reading entries for the editor's article card and roundup blocks.
router.get('/shortform/search', authenticated(), async (req, res) => {
  try {
    const query = String(req.query.q || '').trim();
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filter = query
      ? {
          $or: ['title', 'work', 'author'].map((field) => ({
            [field]: { $regex: escaped, $options: 'i' },
          })),
        }
      : {};
    res.json(
      await ShortformEntry.find(filter, SHORTFORM_CARD_FIELDS)
        .sort({ entryAdded: -1 })
        .limit(10)
        .lean(),
    );
  } catch (err) {
    res.status(500).send({ error: err.message });
  }
});

// The outlet a link would be matched to, for the extension to show before saving.
router.get('/outlet', authenticated(), async (req, res) => {
  try {
    res.json(await outletForUrl(String(req.query.url || '')));
  } catch (err) {
    logger.error('Outlet lookup failed', err);
    res.status(500).send({ message: err.message });
  }
});

// Fields the extension adds that aren't stored on the entry.
//  - postToFeed: also make a feed entry (shortform and press).
//  - archive: queue the link for the Wayback Machine.
//  - addOutletDomain: match this link's domain to the chosen outlet from now on.
// Without an `outlet`, the entry gets the outlet matched from its link, if there is one.
router.post('/entry', authenticated(), async (req, res) => {
  const { type } = req.body;
  const {
    postToFeed,
    archive,
    addOutletDomain: addDomain,
    ...entry
  } = req.body.entry || {};
  const Model = models[type];
  if (!Model) {
    return res.status(400).send({ message: `Unknown entry type "${type}".` });
  }
  let result;
  try {
    if (entry.outlet) {
      if (addDomain) {
        await addOutletDomain(entry.outlet, entry.href);
      }
    } else {
      entry.outlet = (await outletForUrl(entry.href))?._id;
    }
    const tagIds = await updateTagsOnCreate(entry.tags, type);
    result = await new Model({ ...entry, tags: tagIds }).save();

    if (postToFeed) {
      const FeedModel = type === 'press' ? FeedEntryPress : FeedEntryReading;
      await new FeedModel({ [type]: result._id, tags: tagIds }).save();
    }
  } catch (err) {
    return res.status(400).send({ message: err.message });
  }

  // The entry is saved; a failure to queue archiving is reported without undoing it.
  if (archive && result.href) {
    try {
      await queueArchive([result.href]);
    } catch (err) {
      logger.error('Failed to queue archiving', err);
      return res.status(201).send({
        warning: `Saved, but the link couldn’t be queued for archiving: ${err.message}`,
      });
    }
  }
  return res.status(201).send({});
});

export default router;
