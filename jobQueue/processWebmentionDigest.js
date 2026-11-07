import mongoose from 'mongoose';
import { mongoOptions, mongoUri } from '../backend/models/mongoUri.js';
import { WebmentionSchema } from '../backend/models/webmention.schema.js';
import { sendNotification } from './notify.js';

const ADMIN_URL = 'https://www.mollywhite.net/micro/webmentions';

// Notify if any webmentions are waiting for moderation
export async function processWebmentionDigest() {
  const connection = mongoose.createConnection(mongoUri(), mongoOptions);
  try {
    const Webmention = connection.model(
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
    await connection.close();
  }
}
