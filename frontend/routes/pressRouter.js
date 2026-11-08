import express from 'express';
import { getPaginatedAndFilteredFromDb } from '../../api/client.js';
import { tagText } from '../../api/helpers/listFilters.js';
import {
  groupPressByMonth,
  pressHref,
  pressTagChips,
} from '../../api/helpers/pressList.js';
import { ENTITY_SUMMARY_FIELDS } from '../../backend/helpers/entities.js';
import { pressAuthorHtml } from '../../backend/helpers/mentionMarkup.js';
import { loadArchives } from '../../backend/helpers/postContext.js';
import { Entity } from '../../backend/models/entity.model.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const results = await getPaginatedAndFilteredFromDb('press', req);
  const query = {
    tags: req.query.tags ? req.query.tags.split('-') : [],
    search: req.query.search || '',
    order: req.query.order === 'reverse' ? 'reverse' : '',
  };
  const archived = await loadArchives(results.results.map((a) => a.href));
  // Author entities, linked in place of the author as written
  const authorIds = results.results.flatMap((a) => a.authors || []);
  const authors = authorIds.length
    ? await Entity.find(
        { _id: { $in: authorIds } },
        ENTITY_SUMMARY_FIELDS,
      ).lean()
    : [];
  const byId = new Map(authors.map((e) => [String(e._id), e]));
  for (const article of results.results) {
    article.authorHtml = pressAuthorHtml({
      author: article.author,
      authors: (article.authors || []).map((id) => byId.get(String(id))),
    });
  }
  const page = results.currentPage;
  res.render('press.pug', {
    query,
    months: groupPressByMonth(results.results),
    chips: pressTagChips(results.allTags, query),
    archived,
    totalResults: results.totalResults,
    isFiltered: Boolean(query.tags.length || query.search),
    clearHref: pressHref({ order: query.order }),
    newestHref: pressHref({ ...query, order: '' }),
    oldestHref: pressHref({ ...query, order: 'reverse' }),
    currentPage: page,
    totalPages: results.totalPages,
    pageHref: (n) => pressHref({ ...query, page: n }),
    tagHref: (tag) => pressHref({ tags: [tag.value] }),
    tagText,
  });
});

export default router;
