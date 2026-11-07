import mongoose from 'mongoose';
import {
  MICRO_ENTRY_COLLECTION,
  MicroEntrySchema,
} from '../backend/models/micro/microEntry.schema.js';
import { mongoOptions, mongoUri } from '../backend/models/mongoUri.js';
import { WebmentionSchema } from '../backend/models/webmention.schema.js';

// Already validated, so just save
export async function processSaveWebmention({ source, target }) {
  const connection = mongoose.createConnection(mongoUri(), mongoOptions);
  const Webmention = connection.model(
    'Webmention',
    WebmentionSchema,
    'webmentions',
  );

  try {
    const existingWebmention = await Webmention.findOne({ source, target });
    if (existingWebmention) {
      // No need to do anything, because this is an update to a webmention I've already stored.
      // In the future, if I store the body of the source webmention, I would update it here.
      return;
    }

    const webmention = new Webmention({
      source,
      target,
      approved: false,
    });
    const createdWebmention = await webmention.save();

    // Link the webmention to the micro entry, if it refers to one
    const targetUrl = new URL(target);
    if (targetUrl.pathname.startsWith('/micro/entry')) {
      const slug = targetUrl.pathname.split('/')[3];
      if (slug) {
        const MicroEntry = connection.model(
          'MicroEntry',
          MicroEntrySchema,
          MICRO_ENTRY_COLLECTION,
        );
        const entry = await MicroEntry.findOne({ slug });
        if (entry) {
          entry.webmentions.push(createdWebmention._id);
          await entry.save();
        }
      }
    }
  } finally {
    await connection.close();
  }
}
