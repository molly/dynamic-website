import db from './db.js';
import {
  ARCHIVED_LINK_COLLECTION,
  ArchivedLinkSchema,
} from './archivedLink.schema.js';

export { ArchivedLinkSchema };

export const ArchivedLink = db.connection.model(
  'ArchivedLink',
  ArchivedLinkSchema,
  ARCHIVED_LINK_COLLECTION,
);
