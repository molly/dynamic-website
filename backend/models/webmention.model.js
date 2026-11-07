import db from './db.js';
import { WebmentionSchema } from './webmention.schema.js';

export const Webmention = db.connection.model(
  'Webmention',
  WebmentionSchema,
  'webmentions',
);
