import { generateRssForFeed, generateRssForMicro } from '../../helpers/rss.js';
import { sendWebmentions } from '../../helpers/webmentions.js';
import db from '../db.js';
import { MicroEntrySchema } from './microEntry.schema.js';

MicroEntrySchema.pre('save', async function () {
  await sendWebmentions(this);
});

// Generate RSS after each save.
// Don't need to wait for it to complete.
MicroEntrySchema.post('save', function () {
  generateRssForFeed();
  generateRssForMicro();
});

export default db.microConnection.model(
  'MicroEntry',
  MicroEntrySchema,
  'entries',
);
