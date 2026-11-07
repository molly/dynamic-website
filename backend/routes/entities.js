import express from 'express';
import {
  ENTITY_SUMMARY_FIELDS,
  entityModelFor,
  findDuplicateEntities,
  searchEntities,
} from '../helpers/entities.js';
import { ENTITY_TYPES } from '../models/entity.model.js';
import logger from '../winston.js';
import { authenticated } from './auth.js';

const router = express.Router();

// Search for pickers: names, aliases and handles.
router.get('/', authenticated(), async (req, res) => {
  try {
    res.json(await searchEntities(req.query.q));
  } catch (err) {
    logger.error('Entity search failed', err);
    res.status(500).json({ error: err.message });
  }
});

// Create an entity, refusing likely duplicates. A 409 response carries the existing matches:
// - reason "id": a unique ID or account already belongs to another entity. Use that one.
// - reason "name": an entity with the same name exists. Resend with a disambiguator to create
//   a separate entity anyway.
router.post('/', authenticated(), async (req, res) => {
  const { type, ...fields } = req.body;
  if (!ENTITY_TYPES.includes(type)) {
    res.status(400).json({ error: `Unknown entity type "${type}".` });
    return;
  }

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
    if (err.code === 11000) {
      // Same type and slug: same name and disambiguator as an existing entity.
      res.status(409).json({ reason: 'name', matches: similar });
    } else if (err.name === 'ValidationError') {
      res.status(400).json({ error: err.message });
    } else {
      logger.error('Failed to create entity', err);
      res.status(500).json({ error: err.message });
    }
  }
});

export default router;
