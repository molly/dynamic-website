import crypto from 'node:crypto';

export const getUniqueId = (length) => {
  return crypto.randomBytes(length).toString('hex');
};
