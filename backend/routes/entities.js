import express from 'express';
import mongoose from 'mongoose';
import { editablePaths } from '../../api/helpers/entityFields.js';
import { wikidataId, wikidataSuggestions } from '../../api/helpers/wikidata.js';
import {
  ENTITY_SUMMARY_FIELDS,
  entityModelFor,
  findDuplicateEntities,
  relationsFor,
  searchEntities,
} from '../helpers/entities.js';
import {
  ENTITY_TYPES,
  Entity,
  EntityRelation,
} from '../models/entity.model.js';
import { Tag } from '../models/tag.model.js';
import {
  fetchWikidataEntry,
  wikidataIdForArticle,
} from '../helpers/wikidata.js';
import logger from '../winston.js';
import { authenticated } from './auth.js';

const router = express.Router();

// Search for pickers: names, aliases and handles, optionally of one ?type=. With ?ids=a,b, those
// entities instead.
router.get('/', authenticated(), async (req, res) => {
  try {
    if (req.query.ids) {
      const ids = String(req.query.ids)
        .split(',')
        .filter((id) => mongoose.isValidObjectId(id));
      res.json(
        await Entity.find({ _id: { $in: ids } }, ENTITY_SUMMARY_FIELDS).lean(),
      );
      return;
    }
    const type = ENTITY_TYPES.includes(req.query.type)
      ? req.query.type
      : undefined;
    res.json(await searchEntities(req.query.q, { type }));
  } catch (err) {
    logger.error('Entity search failed', err);
    res.status(500).json({ error: err.message });
  }
});

// Entities linked to a feed tag, for the editors to suggest one from the other: adding #coinbase
// suggests @Coinbase for "about", and the other way round.
router.get('/tagged', authenticated(), async (req, res) => {
  try {
    res.json(
      await Entity.find(
        { tag: { $type: 'objectId' } },
        `${ENTITY_SUMMARY_FIELDS} tag`,
      ).lean(),
    );
  } catch (err) {
    logger.error('Failed to list tagged entities', err);
    res.status(500).json({ error: err.message });
  }
});

// Entities a new one with this name would duplicate, for the new-entity dialog to warn as you
// type. Only names: IDs and accounts are checked when the entity is created.
router.get('/check', authenticated(), async (req, res) => {
  try {
    const { similar } = await findDuplicateEntities({ name: req.query.name });
    res.json({ similar });
  } catch (err) {
    logger.error('Entity duplicate check failed', err);
    res.status(500).json({ error: err.message });
  }
});

// What an entity's Wikidata entry offers it (api/helpers/wikidata.js), found by its Wikidata ID
// or, failing that, its Wikipedia article. ?type= picks the fields; nothing is saved here.
router.get('/wikidata', authenticated(), async (req, res) => {
  const { type } = req.query;
  if (!ENTITY_TYPES.includes(type)) {
    res.status(400).json({ error: `Unknown entity type "${type}".` });
    return;
  }
  try {
    const id =
      wikidataId(req.query.wikidata) ||
      (req.query.wikipedia
        ? await wikidataIdForArticle(req.query.wikipedia)
        : null);
    if (!id) {
      res.status(404).json({
        error: req.query.wikipedia
          ? 'Wikidata has no entry for that Wikipedia article.'
          : 'Add a Wikidata ID or a Wikipedia article first.',
      });
      return;
    }
    const entry = await fetchWikidataEntry(id);
    res.json(wikidataSuggestions(entry, type));
  } catch (err) {
    logger.error('Wikidata lookup failed', err);
    res.status(502).json({ error: err.message });
  }
});

// Create an entity, refusing likely duplicates. A 409 response carries the existing matches:
// - reason "id": a unique ID or account already belongs to another entity. Use that one.
// - reason "name": an entity with the same name exists. Resend with a disambiguator to create
//   a separate entity anyway.
router.post('/', authenticated(), async (req, res) => {
  const { type } = req.body;
  if (!ENTITY_TYPES.includes(type)) {
    res.status(400).json({ error: `Unknown entity type "${type}".` });
    return;
  }
  // Only fields the form controls; derived fields like nameKeys are never taken from a request.
  const fields = Object.fromEntries(
    editablePaths(type)
      .filter((path) => req.body[path] !== undefined)
      .map((path) => [path, req.body[path]]),
  );

  let similar = [];
  try {
    const duplicates = await findDuplicateEntities(fields);
    similar = duplicates.similar;
    if (duplicates.blocking.length) {
      res.status(409).json({ reason: 'id', matches: duplicates.blocking });
      return;
    }
    if (similar.length && !fields.disambiguator?.trim()) {
      res.status(409).json({ reason: 'name', matches: similar });
      return;
    }

    const entity = await new (entityModelFor(type))(fields).save();
    res
      .status(201)
      .json(
        Object.fromEntries(
          ['_id', ...ENTITY_SUMMARY_FIELDS.split(' ')].map((f) => [
            f,
            entity[f],
          ]),
        ),
      );
  } catch (err) {
    // A duplicate key here means the same type and slug: same name and disambiguator.
    sendSaveError(res, err, similar);
  }
});

// Errors from saving an entity or relation: duplicates and validation are the user's to fix.
function sendSaveError(res, err, similar = []) {
  if (err.code === 11000) {
    res.status(409).json({ reason: 'name', matches: similar });
  } else if (err.name === 'ValidationError' || err.name === 'CastError') {
    res.status(400).json({ error: err.message });
  } else {
    logger.error('Failed to save', err);
    res.status(500).json({ error: err.message });
  }
}

// Relations ------------------------------------------------------------------------------------

// A relation as the admin sends it: seen from `entity`, pointing at `other`.
function relationFields({ entity, direction, other, ...fields }) {
  const [from, to] = direction === 'to' ? [other, entity] : [entity, other];
  return {
    from,
    to,
    kind: fields.kind,
    role: fields.role || undefined,
    start: fields.start || undefined,
    end: fields.end || undefined,
    amountUsd: fields.amountUsd ?? undefined,
    source: fields.source || undefined,
  };
}

router.post('/:id/relations', authenticated(), async (req, res) => {
  try {
    await new EntityRelation(
      relationFields({ ...req.body, entity: req.params.id }),
    ).save();
    res.status(201).json(await relationsFor(req.params.id));
  } catch (err) {
    sendSaveError(res, err);
  }
});

router.put('/relations/:relationId', authenticated(), async (req, res) => {
  try {
    const relation = await EntityRelation.findById(req.params.relationId);
    if (!relation) {
      res.sendStatus(404);
      return;
    }
    relation.set(relationFields(req.body));
    await relation.save();
    res.json(await relationsFor(req.body.entity));
  } catch (err) {
    sendSaveError(res, err);
  }
});

router.delete('/relations/:relationId', authenticated(), async (req, res) => {
  try {
    await EntityRelation.deleteOne({ _id: req.params.relationId });
    res.sendStatus(204);
  } catch (err) {
    sendSaveError(res, err);
  }
});

// One entity -------------------------------------------------------------------------------------

function loadEntity(id) {
  if (!mongoose.isValidObjectId(id)) {
    return null;
  }
  return Entity.findById(id)
    .populate({ path: 'tag', model: Tag, select: 'text value' })
    .lean();
}

router.get('/:id', authenticated(), async (req, res) => {
  try {
    const entity = await loadEntity(req.params.id);
    if (!entity) {
      res.sendStatus(404);
      return;
    }
    res.json({ entity, relations: await relationsFor(entity._id) });
  } catch (err) {
    sendSaveError(res, err);
  }
});

// Update an entity from the admin form. Every field the form controls is set from the request, so
// a field left out is cleared. The type can't change.
router.put('/:id', authenticated(), async (req, res) => {
  let similar = [];
  try {
    const entity = await Entity.findById(req.params.id);
    if (!entity) {
      res.sendStatus(404);
      return;
    }
    const paths = editablePaths(entity.type);
    const updates = Object.fromEntries(
      paths.map((path) => [path, req.body[path] ?? undefined]),
    );

    const duplicates = await findDuplicateEntities(updates, entity._id);
    similar = duplicates.similar;
    if (duplicates.blocking.length) {
      res.status(409).json({ reason: 'id', matches: duplicates.blocking });
      return;
    }
    if (similar.length && !updates.disambiguator?.trim()) {
      res.status(409).json({ reason: 'name', matches: similar });
      return;
    }

    for (const path of paths) {
      // A cleared list is an empty list; any other cleared field is unset.
      const isArray = entity.schema.path(path)?.instance === 'Array';
      entity.set(path, updates[path] ?? (isArray ? [] : undefined));
    }
    await entity.save();
    res.json({
      entity: await loadEntity(entity._id),
      relations: await relationsFor(entity._id),
    });
  } catch (err) {
    sendSaveError(res, err, similar);
  }
});

export default router;
