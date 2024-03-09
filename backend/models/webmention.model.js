import db from './db.js';
import { WebmentionSchema } from './webmention.schema.js';

export const Webmention = db.webmentionConnection.model(
  'Webmention',
  WebmentionSchema,
  'webmentions',
);
