import crypto from 'node:crypto';
import config from '../config/auth.config.js';

const GHOST_WEBHOOK_HEADER = 'X-Ghost-Signature';
const FIVE_MINUTES = 5 * 60 * 1000;

export function validateGhostWebhook(req, res, next) {
  try {
    if (req.get(GHOST_WEBHOOK_HEADER)) {
      const sig_header = req.get(GHOST_WEBHOOK_HEADER);

      if (!/^sha256=([a-z0-9]*?), t=\d+$/.test(sig_header)) {
        return res
          .status(403)
          .send({ message: 'Malformed Ghost webhook signature' });
      }

      let [signature, timestampStr] = sig_header.split(', ');
      signature = signature.replace('sha256=', '');
      timestampStr = timestampStr.replace('t=', '');

      // Check timestamp is reasonably recent
      const timestamp = parseInt(timestampStr, 10);
      if (isNaN(timestamp)) {
        return res
          .status(403)
          .send({ message: 'Malformed Ghost webhook signature' });
      }
      if (Math.abs(Date.now() - timestamp) > FIVE_MINUTES) {
        return res.status(403).send({ message: 'Stale Ghost webhook' });
      }

      const body = JSON.stringify(req.body || {});
      const expected = crypto
        .createHmac('sha256', config.ghostWebhookSecret)
        .update(body)
        .digest('hex');
      if (expected === signature) {
        next();
      } else {
        return res
          .status(403)
          .send({ message: 'Invalid Ghost webhook signature' });
      }
    } else {
      return res
        .status(403)
        .send({ message: 'Ghost webhook signature missing from request' });
    }
  } catch (error) {
    console.error(error);
  }
}
