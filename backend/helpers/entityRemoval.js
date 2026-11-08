import * as cheerio from 'cheerio';

import { fieldsFor } from '../../api/helpers/entityFields.js';
import { Entity, EntityRelation } from '../models/entity.model.js';
import { PressEntry, ShortformEntry } from '../models/entry.model.js';
import { FeedEntry } from '../models/feed/feedEntry.model.js';
import MicroEntry from '../models/micro/microEntry.model.js';
import { accountKey, nameKey } from './entityKeys.js';

// Deleting an entity, or merging a duplicate into the one to keep. Entities are referenced from:
//  - posts (and their updates and cross-post threads): @mentions, <span data-entity="ID">, and
//    documents' senders, recipients and case, as { _id, name, type }
//  - feed entries' "about"
//  - relations, from either end
//  - reading and press entries' outlet
// Deleting turns its mentions into plain text and drops it everywhere else; merging points
// everything at the entity kept, and gives it the duplicate's accounts, names and anything else
// it doesn't have.

const idOf = (value) => String(value?._id ?? value);

// The fields of a post that can hold entities
const POST_FIELDS = ['post', 'updates', 'socialThreads'];

// An entity as a document block stores it
const summaryOf = (entity) =>
  entity ? { _id: entity._id, name: entity.name, type: entity.type } : null;

const isEntityRef = (value, id) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  idOf(value._id) === id &&
  Object.keys(value).every((key) => ['_id', 'name', 'type'].includes(key));

/**
 * A post's content with one entity replaced: its mentions point at `into` (or become plain text),
 * and documents' references to it become `into` (or are dropped, keeping the names as written).
 * @param {*} value Any part of a post
 * @param {string} id The entity being removed
 * @param {?Object} into The entity it's merged into, or null when it's deleted
 * @returns {*} The same value, changed where it referred to the entity
 */
export function replaceEntityIn(value, id, into) {
  if (typeof value === 'string') {
    if (!value.includes(`data-entity="${id}"`)) {
      return value;
    }
    if (into) {
      return value
        .split(`data-entity="${id}"`)
        .join(`data-entity="${idOf(into)}"`);
    }
    const $ = cheerio.load(value, null, false);
    $(`span[data-entity="${id}"]`).each((_, el) => {
      $(el).replaceWith($(el).html());
    });
    return $.html();
  }
  if (Array.isArray(value)) {
    return value.map((item) => replaceEntityIn(item, id, into));
  }
  if (isEntityRef(value, id)) {
    return summaryOf(into);
  }
  if (value && typeof value === 'object' && value.constructor === Object) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        replaceEntityIn(item, id, into),
      ]),
    );
  }
  return value;
}

// Whether a part of a post refers to the entity at all
const refersTo = (value, id) => JSON.stringify(value ?? null).includes(id);

/**
 * Everything that refers to an entity, for the editor to show before deleting or merging.
 * @param {string} id
 */
export async function entityUsage(id) {
  const posts = await MicroEntry.find(
    {},
    `slug ${POST_FIELDS.join(' ')}`,
  ).lean();
  const [about, relations, reading, press] = await Promise.all([
    FeedEntry.countDocuments({ about: id }),
    EntityRelation.countDocuments({ $or: [{ from: id }, { to: id }] }),
    ShortformEntry.countDocuments({ outlet: id }),
    PressEntry.countDocuments({ outlet: id }),
  ]);
  return {
    posts: posts
      .filter((post) => POST_FIELDS.some((field) => refersTo(post[field], id)))
      .map((post) => post.slug),
    about,
    relations,
    outletOf: reading + press,
  };
}

// Rewrite every post that refers to the entity
async function replaceInPosts(id, into) {
  const posts = await MicroEntry.find(
    {},
    `_id ${POST_FIELDS.join(' ')}`,
  ).lean();
  let changed = 0;
  for (const post of posts) {
    const set = {};
    for (const field of POST_FIELDS) {
      if (post[field] !== undefined && refersTo(post[field], id)) {
        set[field] = replaceEntityIn(post[field], id, into);
      }
    }
    if (Object.keys(set).length) {
      // Straight to the collection: saving through the model would resend webmentions
      await MicroEntry.collection.updateOne({ _id: post._id }, { $set: set });
      changed++;
    }
  }
  return changed;
}

/**
 * Delete an entity: its relations go, it's dropped from "about" and from outlets, documents keep
 * the names as written, and its mentions become plain text.
 * @param {string} id
 */
export async function deleteEntity(id) {
  const entity = await Entity.findById(id);
  if (!entity) {
    throw new Error('There’s no such entity.');
  }
  const posts = await replaceInPosts(id, null);
  await Promise.all([
    FeedEntry.updateMany({ about: id }, { $pull: { about: entity._id } }),
    EntityRelation.deleteMany({ $or: [{ from: id }, { to: id }] }),
    ShortformEntry.updateMany({ outlet: id }, { $unset: { outlet: '' } }),
    PressEntry.updateMany({ outlet: id }, { $unset: { outlet: '' } }),
  ]);
  await Entity.deleteOne({ _id: id });
  return { posts };
}

const isEmpty = (value) =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && !value.length);

// The same item in a list of two entities': same account, name, link or FEC ID
const LIST_KEYS = {
  accounts: (a) => accountKey(a.network, a.handle),
  aliases: (a) => nameKey(a.name || ''),
  elsewhere: (link) => link.url,
  candidacies: (c) => c.fecCandidateId || JSON.stringify(c),
  domains: (d) => d,
};

/**
 * What the entity kept gets from a duplicate merged into it: its accounts, other links and the
 * like, added to its own; its name, as another name; and any other field the kept entity has left
 * empty. Nothing the kept entity already has is changed.
 * @param {Object} keep The entity kept (plain object)
 * @param {Object} duplicate The entity merged into it (plain object)
 * @returns {Object} Fields to set on the kept entity
 */
export function mergedFields(keep, duplicate) {
  const set = {};
  for (const field of fieldsFor(keep.type)) {
    const [top, sub] = field.name.split('.');
    const ours = sub ? keep[top]?.[sub] : keep[top];
    const theirs = sub ? duplicate[top]?.[sub] : duplicate[top];
    if (isEmpty(theirs) || field.name === 'name' || field.name === 'hasPage') {
      continue;
    }
    if (Array.isArray(theirs)) {
      const key = LIST_KEYS[field.name] || ((item) => JSON.stringify(item));
      const have = new Set((ours || []).map(key));
      if (field.name === 'aliases') {
        have.add(nameKey(keep.name || '')); // Its own name isn't another name of it
      }
      const extra = theirs.filter((item) => !have.has(key(item)));
      if (extra.length) {
        set[field.name] = [...(ours || []), ...extra];
      }
    } else if (isEmpty(ours)) {
      set[field.name] = theirs;
    }
  }
  // The duplicate's name, and its own other names, become other names of the kept entity
  const names = new Set(
    [keep.name, ...(set.aliases || keep.aliases || []).map((a) => a.name)].map(
      nameKey,
    ),
  );
  const extraNames = [duplicate.name]
    .filter((name) => name && !names.has(nameKey(name)))
    .map((name) => ({ name, kind: 'other' }));
  if (extraNames.length) {
    set.aliases = [...(set.aliases || keep.aliases || []), ...extraNames];
  }
  return set;
}

/**
 * Merge a duplicate into the entity kept: everything that referred to the duplicate refers to the
 * kept one, which gets the duplicate's accounts, names and anything else it lacks (mergedFields).
 * Then the duplicate is deleted.
 * @param {string} duplicateId
 * @param {string} keepId
 */
export async function mergeEntity(duplicateId, keepId) {
  if (idOf(duplicateId) === idOf(keepId)) {
    throw new Error('An entity can’t be merged into itself.');
  }
  const [duplicate, keep] = await Promise.all([
    Entity.findById(duplicateId).lean(),
    Entity.findById(keepId),
  ]);
  if (!duplicate || !keep) {
    throw new Error('There’s no such entity.');
  }

  // The duplicate goes first, so its accounts and IDs (which must be unique) can move to the
  // kept entity. If the kept entity won't save, the duplicate is put back as it was.
  await Entity.deleteOne({ _id: duplicate._id });
  try {
    keep.set(mergedFields(keep.toObject(), duplicate));
    await keep.save();
  } catch (err) {
    await Entity.collection.insertOne(duplicate);
    throw err;
  }

  const posts = await replaceInPosts(idOf(duplicate), keep);
  // "About": the kept entity where the duplicate was, once
  await FeedEntry.updateMany(
    { about: duplicate._id },
    { $addToSet: { about: keep._id } },
  );
  await FeedEntry.updateMany(
    { about: duplicate._id },
    { $pull: { about: duplicate._id } },
  );
  await Promise.all([
    ShortformEntry.updateMany(
      { outlet: duplicate._id },
      { $set: { outlet: keep._id } },
    ),
    PressEntry.updateMany(
      { outlet: duplicate._id },
      { $set: { outlet: keep._id } },
    ),
  ]);

  // Relations: moved to the kept entity, except one between the two (it would be with itself) or
  // one the kept entity already has
  const relations = await EntityRelation.find({
    $or: [{ from: duplicate._id }, { to: duplicate._id }],
  });
  for (const relation of relations) {
    const from =
      idOf(relation.from) === idOf(duplicate) ? keep._id : relation.from;
    const to = idOf(relation.to) === idOf(duplicate) ? keep._id : relation.to;
    const already =
      idOf(from) === idOf(to) ||
      (await EntityRelation.exists({
        _id: { $ne: relation._id },
        from,
        to,
        kind: relation.kind,
        role: relation.role,
      }));
    if (already) {
      await relation.deleteOne();
    } else {
      relation.set({ from, to });
      await relation.save();
    }
  }
  return { posts, keep: idOf(keep) };
}
