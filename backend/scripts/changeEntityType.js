/**
 * Change entities' types: for the few that were made with the wrong one (organizations migrated as
 * people). Each keeps its ID, so mentions, "about" and relations still point at it. Fields the new
 * type doesn't have are dropped, and listed first; an organization gets the kind you give.
 *
 *   node backend/scripts/changeEntityType.js "404 Media=organization/outlet" "Web3 is Going Just Great=project"
 *   node backend/scripts/changeEntityType.js … --apply
 *
 * Each argument is "Name=type" or "Name=organization/kind", matching the entity's name exactly.
 * A dry run by default. Refuses a change when the name matches more than one entity, or when an
 * entity of the new type already has the same address (slug). Their pages, if they have them,
 * move to the new type's address.
 */
import { fieldsFor } from '../../api/helpers/entityFields.js';
import {
  ENTITY_TYPES,
  ORGANIZATION_KINDS,
} from '../../api/helpers/entityTypes.js';
import db from '../models/db.js';

const topLevel = (type) =>
  new Set(fieldsFor(type).map((f) => f.name.split('.')[0]));

const isSet = (value) =>
  value !== undefined &&
  value !== null &&
  value !== '' &&
  !(Array.isArray(value) && !value.length);

function parse(arg) {
  const match = /^(.+)=([a-z]+)(?:\/(.+))?$/.exec(arg);
  if (!match) {
    throw new Error(
      `Couldn't read "${arg}": use "Name=type" or "Name=organization/kind".`,
    );
  }
  const [, name, type, kind] = match;
  if (!ENTITY_TYPES.includes(type)) {
    throw new Error(`"${type}" isn't a type (${ENTITY_TYPES.join(', ')}).`);
  }
  if (kind && (type !== 'organization' || !ORGANIZATION_KINDS.includes(kind))) {
    throw new Error(
      `"${kind}" isn't an organization kind (${ORGANIZATION_KINDS.join(', ')}).`,
    );
  }
  return { name: name.trim(), type, kind };
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const changes = args.filter((a) => a !== '--apply').map(parse);
  if (!changes.length) {
    console.log('Nothing to change: give "Name=type" arguments.');
    return;
  }
  await db.initialize();
  const entities = db.connection.collection('entities');

  let changed = 0;
  for (const { name, type, kind } of changes) {
    const found = await entities.find({ name }).toArray();
    if (found.length !== 1) {
      console.log(
        `✗ ${name}: ${found.length ? `${found.length} entities have this name` : 'no entity has this name'}; skipped.`,
      );
      continue;
    }
    const [entity] = found;
    if (entity.type === type && (!kind || entity.kind === kind)) {
      console.log(`· ${name} is already ${type}${kind ? ` (${kind})` : ''}.`);
      continue;
    }
    const clash = await entities.findOne({
      type,
      slug: entity.slug,
      _id: { $ne: entity._id },
    });
    if (clash) {
      console.log(
        `✗ ${name}: “${clash.name}” is already a ${type} at /${entity.slug}; skipped.`,
      );
      continue;
    }
    const keep = topLevel(type);
    const dropped = [...topLevel(entity.type)].filter(
      (field) => !keep.has(field) && isSet(entity[field]),
    );
    const unset = Object.fromEntries(
      [...topLevel(entity.type)]
        .filter((field) => !keep.has(field))
        .map((f) => [f, '']),
    );
    console.log(
      `→ ${name}: ${entity.type} → ${type}${kind ? ` (${kind})` : ''}${dropped.length ? `; drops ${dropped.join(', ')}` : ''}${entity.hasPage ? '; its page moves' : ''}`,
    );
    changed++;
    if (apply) {
      await entities.updateOne(
        { _id: entity._id },
        {
          $set: {
            type,
            ...(type === 'organization' ? { kind: kind || 'company' } : {}),
          },
          ...(Object.keys(unset).length ? { $unset: unset } : {}),
        },
      );
    }
  }
  console.log(
    `\n${changed} entit${changed === 1 ? 'y' : 'ies'} ${apply ? 'changed' : 'to change (add --apply to change them)'}.`,
  );
  await db.gracefulClose();
}

main().catch(async (err) => {
  console.error(err.message);
  process.exitCode = 1;
  await db.gracefulClose();
});
