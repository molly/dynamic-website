// Helpers the redesigned templates call, registered on the app's locals in index.js.
import { formatDuration, readDate, renderArticleCard } from './blocks.js';
import { entryMeta, shortDate, updateTime } from './entryMeta.js';
import { feedExcerpt } from './feedExcerpt.js';
import { pagerItems } from './pager.js';
import { groupReading } from './readingGroups.js';
import { navState, SITE_BAR, SITE_MENU } from './siteNav.js';

export const siteLocals = {
  articleCard: renderArticleCard,
  entryMeta,
  feedExcerpt,
  formatDuration,
  readDate,
  groupReading,
  navState,
  pagerItems,
  shortDate,
  siteBar: SITE_BAR,
  siteMenu: SITE_MENU,
  updateTime,
};
