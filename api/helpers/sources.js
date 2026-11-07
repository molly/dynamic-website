import * as cheerio from 'cheerio';

// Suggested sources for a post: links in it that point at primary documents (PDFs, court dockets,
// regulatory filings, bill pages). The editor offers them; nothing is added without a click.

const DOCUMENT_LINKS = [
  { test: (u) => /\.pdf$/i.test(u.pathname), label: null },
  {
    test: (u) =>
      u.hostname.endsWith('courtlistener.com') &&
      u.pathname.startsWith('/docket/'),
    label: 'docket',
  },
  {
    test: (u) => /(^|\.)uscourts\.gov$/.test(u.hostname),
    label: 'court filing',
  },
  {
    test: (u) =>
      u.hostname.endsWith('sec.gov') &&
      /^\/(Archives\/edgar|cgi-bin\/browse-edgar|ix)/.test(u.pathname),
    label: 'SEC filing',
  },
  {
    test: (u) =>
      u.hostname === 'docquery.fec.gov' ||
      (u.hostname.endsWith('fec.gov') && u.pathname.startsWith('/data/')),
    label: 'FEC filing',
  },
  {
    test: (u) =>
      u.hostname.endsWith('documentcloud.org') &&
      u.pathname.startsWith('/documents/'),
    label: null,
  },
  {
    test: (u) =>
      u.hostname.endsWith('congress.gov') && u.pathname.startsWith('/bill/'),
    label: 'bill',
  },
];

// Text blocks whose HTML can hold links, and where that HTML is.
function blockHtml(block) {
  switch (block.type) {
    case 'paragraph':
    case 'header':
    case 'quote':
      return [block.data?.text, block.data?.caption];
    case 'list':
      return (block.data?.items || []).map((item) =>
        typeof item === 'string' ? item : item?.content,
      );
    case 'image':
    case 'gallery':
      return [
        block.data?.caption,
        ...(block.data?.files || []).map((f) => f.caption),
      ];
    default:
      return [];
  }
}

function labelFor(url, rule, linkText) {
  const text = (linkText || '').trim();
  if (text && text !== url.href && !/^https?:\/\//.test(text)) {
    return text;
  }
  if (rule.label) {
    return rule.label;
  }
  const file = decodeURIComponent(url.pathname.split('/').pop() || '');
  return file.replace(/\.pdf$/i, '') || url.hostname;
}

function normalize(text) {
  try {
    return new URL(text).href;
  } catch {
    return text;
  }
}

/**
 * Links in a post that look like primary documents, labelled from their link text.
 * @param {Object[]} blocks EditorJS blocks
 * @param {{url: string}[]} [existing] Sources already on the post, which aren't suggested again
 * @returns {{label: string, url: string}[]}
 */
export function suggestSources(blocks, existing = []) {
  const seen = new Set(existing.map((s) => normalize(s.url)));
  const suggestions = [];
  const add = (label, url) => {
    if (url && !seen.has(normalize(url))) {
      seen.add(normalize(url));
      suggestions.push({ label, url: normalize(url) });
    }
  };
  for (const block of blocks || []) {
    if (block.type === 'comparison') {
      suggestions.push(
        ...suggestSources(
          [block.data?.left?.block, block.data?.right?.block].filter(Boolean),
          [...existing, ...suggestions],
        ),
      );
      suggestions.forEach((s) => seen.add(s.url));
      continue;
    }
    if (block.type === 'document') {
      const { title, docType, pdfUrl, docketUrl } = block.data || {};
      const name = title || (docType === 'letter' ? 'letter' : 'document');
      add(`${name} (PDF)`, pdfUrl);
      add('docket', docketUrl);
      continue;
    }
    for (const html of blockHtml(block)) {
      if (!html) {
        continue;
      }
      const $ = cheerio.load(html, null, false);
      $('a[href]').each((_, el) => {
        let url;
        try {
          url = new URL($(el).attr('href'));
        } catch {
          return;
        }
        const rule = DOCUMENT_LINKS.find((r) => r.test(url));
        if (!rule || seen.has(url.href)) {
          return;
        }
        seen.add(url.href);
        suggestions.push({
          label: labelFor(url, rule, $(el).text()),
          url: url.href,
        });
      });
    }
  }
  return suggestions;
}
