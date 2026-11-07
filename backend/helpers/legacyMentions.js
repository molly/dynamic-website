import { mentionSignature } from '../../api/helpers/mentions.js';
import { accountKey, nameKey } from './entityKeys.js';
import { Entity, PersonEntity } from '../models/entity.model.js';

// Turning old-format mentions (handles written into the post) into entities, for the copy script.

/**
 * Find or create the entity for each distinct legacy mention:
 * 1. an entity with one of its accounts, if exactly one has any of them;
 * 2. otherwise an entity with the same name, if exactly one has it;
 * 3. otherwise a new mention-only person.
 * More than one match at either step is ambiguous: reported, and left in the old format.
 * Accounts on the mention that the matched entity lacks are added to it.
 * @param {{name: string, accounts: Object[], where: string}[]} mentions
 * @param {{dryRun?: boolean}} options With dryRun, nothing is created or changed
 * @returns {Promise<{ids: Map<string, ?string>, created: string[], updated: string[], ambiguous: Object[]}>}
 */
export async function resolveLegacyMentions(mentions, { dryRun = false } = {}) {
  const ids = new Map();
  const created = [];
  const updated = [];
  const ambiguous = [];

  for (const mention of mentions) {
    const signature = mentionSignature(mention);
    if (ids.has(signature) || !mention.name) {
      continue;
    }
    const keys = mention.accounts.map((a) => accountKey(a.network, a.handle));
    let matches = keys.length
      ? await Entity.find({ accountKeys: { $in: keys } })
      : [];
    if (!matches.length) {
      matches = await Entity.find({ nameKeys: nameKey(mention.name) });
    }

    if (matches.length > 1) {
      ambiguous.push({
        where: mention.where,
        name: mention.name,
        candidates: matches.map((m) => m.name),
      });
      ids.set(signature, null);
      continue;
    }

    if (matches.length === 1) {
      const [entity] = matches;
      const missing = mention.accounts.filter(
        (a) => !entity.accountKeys.includes(accountKey(a.network, a.handle)),
      );
      if (missing.length && !dryRun) {
        entity.accounts.push(...missing);
        await entity.save();
        updated.push(entity.name);
      }
      ids.set(signature, String(entity._id));
      continue;
    }

    if (dryRun) {
      created.push(mention.name);
      ids.set(signature, null);
      continue;
    }
    const entity = await new PersonEntity({
      // The words as written can be "@handle" or possessive ("Taylor Lorenz’s"); the entity's
      // name shouldn't be. The post keeps the words as written.
      name: mention.name
        .trim()
        .replace(/^@/, '')
        .replace(/['\u2019]s$/i, ''),
      accounts: mention.accounts,
      hasPage: false,
    }).save();
    created.push(entity.name);
    ids.set(signature, String(entity._id));
  }

  return { ids, created, updated, ambiguous };
}
