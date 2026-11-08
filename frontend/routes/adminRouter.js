import express from 'express';
import mongoose from 'mongoose';
import { ENTITY_TYPE_NAMES, entityUrl } from '../../api/helpers/entityUrls.js';
import { ENTITY_TYPES } from '../../api/helpers/entityTypes.js';
import {
  relationsFor,
  searchEntities,
} from '../../backend/helpers/entities.js';
import { listThreads, threadEntries } from '../../backend/helpers/threads.js';
import { Entity } from '../../backend/models/entity.model.js';
import { Tag } from '../../backend/models/tag.model.js';
import { Thread } from '../../backend/models/thread.model.js';
import { authenticated } from '../../backend/routes/auth.js';

const router = express.Router();
const PAGE_SIZE = 50;

// Express 4 doesn't catch rejected promises from handlers; pass them to its error handler.
const asyncRoute = (handler) => (req, res, next) =>
  handler(req, res, next).catch(next);

router.use(authenticated({ redirectTo: '/micro/login' }));

router.get('/', (req, res) => res.redirect('/admin/entities'));

// Entities -------------------------------------------------------------------------------------

router.get(
  '/entities',
  asyncRoute(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const type = ENTITY_TYPES.includes(req.query.type)
      ? req.query.type
      : undefined;
    const q = req.query.q || '';
    const bare = req.query.bare === '1';
    // One extra, to know whether there's a next page.
    const entities = await searchEntities(q, {
      type,
      bare,
      newestFirst: true,
      limit: PAGE_SIZE + 1,
      skip: (page - 1) * PAGE_SIZE,
    });
    res.render('admin/entities.pug', {
      adminPage: 'entities',
      title: 'Entities',
      entities: entities.slice(0, PAGE_SIZE),
      hasMore: entities.length > PAGE_SIZE,
      page,
      type,
      q,
      bare,
      ENTITY_TYPES,
    });
  }),
);

router.get('/entities/new', (req, res) => {
  const type = ENTITY_TYPES.includes(req.query.type)
    ? req.query.type
    : 'person';
  res.render('admin/entity.pug', {
    adminPage: 'entity',
    title: `New ${type}`,
    typeName: ENTITY_TYPE_NAMES[type].one,
    pageData: { entity: null, type, relations: [] },
  });
});

router.get(
  '/entities/:id',
  asyncRoute(async (req, res) => {
    const entity = mongoose.isValidObjectId(req.params.id)
      ? await Entity.findById(req.params.id)
          .populate({ path: 'tag', model: Tag, select: 'text value' })
          .lean()
      : null;
    if (!entity) {
      res.status(404).send('No such entity.');
      return;
    }
    res.render('admin/entity.pug', {
      adminPage: 'entity',
      title: entity.name,
      typeName: ENTITY_TYPE_NAMES[entity.type]?.one || entity.type,
      viewHref: entityUrl(entity),
      pageData: {
        entity,
        type: entity.type,
        relations: await relationsFor(entity._id),
      },
    });
  }),
);

// Threads --------------------------------------------------------------------------------------

router.get(
  '/threads',
  asyncRoute(async (req, res) => {
    res.render('admin/threads.pug', {
      adminPage: 'threads',
      title: 'Threads',
      threads: await listThreads(),
    });
  }),
);

router.get(
  '/threads/:id',
  asyncRoute(async (req, res) => {
    const thread = mongoose.isValidObjectId(req.params.id)
      ? await Thread.findById(req.params.id).lean()
      : null;
    if (!thread) {
      res.status(404).send('No such thread.');
      return;
    }
    const entries = await threadEntries(thread._id);
    res.render('admin/thread.pug', {
      adminPage: 'thread',
      title: thread.title || 'Untitled thread',
      thread,
      entries,
      pageData: { thread, entryCount: entries.length },
    });
  }),
);

export default router;
