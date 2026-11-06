import { ServerApiVersion } from 'mongodb';
import mongoose from 'mongoose';
import { WebmentionSchema } from '../backend/models/webmention.schema.js';
import { sendNotification } from './notify.js';

const ADMIN_URL = 'https://www.mollywhite.net/micro/webmentions';

// Notify if any webmentions are waiting for moderation
export async function processWebmentionDigest() {
  const webmentionConnection = mongoose.createConnection(
    `mongodb+srv://reading-list:${process.env.PASSWORD}@cluster0.ptjwk.mongodb.net/webmentions?retryWrites=true&w=majority`,
    {
      serverApi: ServerApiVersion.v1,
    },
  );
  try {
    const Webmention = webmentionConnection.model(
      'Webmention',
      WebmentionSchema,
      'webmentions',
    );
    const pending = await Webmention.countDocuments({
      approved: false,
      rejectedAt: null,
    });
    if (pending === 0) {
      return { pending };
    }
    await sendNotification({
      title: 'Webmentions to review',
      message: `${pending} webmention${pending === 1 ? '' : 's'} waiting for review.`,
      click: ADMIN_URL,
      tags: ['speech_balloon'],
    });
    return { pending };
  } finally {
    await webmentionConnection.close();
  }
}
