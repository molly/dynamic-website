// Work out every post's related entries again (npm run related). Saving a post refreshes the
// posts around it; run this after bulk changes to tags or "about", or to fill the lists in.
import { rebuildAllRelated } from '../helpers/related.js';
import db from '../models/db.js';

async function main() {
  await db.initialize();
  const updated = await rebuildAllRelated();
  console.log(`Updated related entries for ${updated} posts.`);
  process.exit(0);
}

main();
