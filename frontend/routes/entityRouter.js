import express from 'express';
import {
  ENTITY_SEGMENTS,
  ENTITY_TYPE_NAMES,
  typeForSegment,
} from '../../api/helpers/entityUrls.js';
import {
  loadEntityIndex,
  loadEntityPage,
} from '../../backend/helpers/entityPage.js';

// Entity pages: /entities, /entities/<type> and /entities/<type>/<slug>. Only entities with a page
// (hasPage) are shown; the rest only power @mentions.
const router = express.Router();

const notFound = (res) => res.status(404).render('micro/404.pug');

router.get('/', async (req, res) => {
  const entities = await loadEntityIndex();
  const groups = Object.keys(ENTITY_SEGMENTS)
    .map((type) => ({
      type,
      href: `/entities/${ENTITY_SEGMENTS[type]}`,
      name: ENTITY_TYPE_NAMES[type].many,
      entities: entities.filter((e) => e.type === type),
    }))
    .filter((group) => group.entities.length);
  res.render('entities/index.pug', { groups });
});

router.get('/:segment', async (req, res) => {
  const type = typeForSegment(req.params.segment);
  if (!type) {
    notFound(res);
    return;
  }
  res.render('entities/type.pug', {
    type,
    segment: req.params.segment,
    name: ENTITY_TYPE_NAMES[type].many,
    entities: await loadEntityIndex(type),
  });
});

router.get('/:segment/:slug', async (req, res) => {
  const type = typeForSegment(req.params.segment);
  const page = type
    ? await loadEntityPage(type, String(req.params.slug), {
        filter: String(req.query.type || ''),
        all: req.query.all === '1',
      })
    : null;
  if (!page) {
    notFound(res);
    return;
  }
  res.render('entities/entity.pug', {
    page,
    segment: req.params.segment,
    options: { isLoggedIn: req.isAuthenticated() },
  });
});

export default router;
