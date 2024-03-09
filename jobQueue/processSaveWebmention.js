import { ServerApiVersion } from 'mongodb';
import mongoose from 'mongoose';
import { MicroEntrySchema } from '../backend/models/micro/microEntry.schema.js';
import { WebmentionSchema } from '../backend/models/webmention.schema.js';

// Already validated, so just save
export async function processSaveWebmention({ source, target }) {
  const webmentionConnection = mongoose.createConnection(
    `mongodb+srv://reading-list:${process.env.PASSWORD}@cluster0.ptjwk.mongodb.net/webmentions?retryWrites=true&w=majority`,
    {
      serverApi: ServerApiVersion.v1,
    },
  );
  const Webmention = webmentionConnection.model(
    'Webmention',
    WebmentionSchema,
    'webmentions',
  );

  let microConnection;
  let MicroEntry;

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
      microConnection = mongoose.createConnection(
        `mongodb+srv://reading-list:${process.env.PASSWORD}@cluster0.ptjwk.mongodb.net/micro?retryWrites=true&w=majority`,
        {
          serverApi: ServerApiVersion.v1,
        },
      );
      MicroEntry = microConnection.model(
        'MicroEntry',
        MicroEntrySchema,
        'entries',
      );
      const entry = await MicroEntry.findOne({ slug });
      if (entry) {
        entry.webmentions.push(createdWebmention._id);
        await entry.save();
      }
      await microConnection.close();
    }
  }
  await webmentionConnection.close();
}
