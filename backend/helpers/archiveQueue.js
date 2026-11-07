// The archive queue's name, shared by the server (which adds jobs) and jobQueue/consumer.js (which
// runs them). Kept on its own so the consumer doesn't load the server's database connection.
export const ARCHIVE_QUEUE = 'archiveQueue';
