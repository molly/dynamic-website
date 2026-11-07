// Helpers the redesigned templates call, registered on the app's locals in index.js.
import { renderArticleCard } from './blocks.js';
import { entryMeta, shortDate, updateTime } from './entryMeta.js';
import { feedExcerpt } from './feedExcerpt.js';
import { groupReading } from './readingGroups.js';

export const siteLocals = {
  articleCard: renderArticleCard,
  entryMeta,
  feedExcerpt,
  groupReading,
  shortDate,
  updateTime,
};
