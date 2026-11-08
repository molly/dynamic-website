import { DateTime } from 'luxon';
import { formatPartialDate } from './partialDate.js';
import { NETWORK_LABELS, getSocialLinkFromHandle } from './socialMedia.js';

// The details an entity page shows from the entity's own fields: its accounts and links
// ("Elsewhere"), its type's facts ("At a glance") and its former names. Rows are { label, value, href }
// for the page's rows mixin. See pug/views/entities/entity.pug.

const ZONE = 'America/New_York';

// Dates saved as a day (midnight Eastern)
const day = (date) =>
  date
    ? DateTime.fromJSDate(new Date(date), { zone: ZONE }).toFormat(
        'LLL d, yyyy',
      )
    : null;
const month = (date) =>
  date
    ? DateTime.fromJSDate(new Date(date), { zone: ZONE }).toFormat('LLL yyyy')
    : null;

/**
 * "$25,000", "$4.5 million", "$1.2 billion".
 * @param {?number} amount
 */
export function formatUsd(amount) {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return null;
  }
  const scaled = (n, word) =>
    `$${Number((amount / n).toFixed(amount / n >= 100 ? 0 : 1))} ${word}`;
  if (amount >= 1e9) {
    return scaled(1e9, 'billion');
  }
  if (amount >= 1e6) {
    return scaled(1e6, 'million');
  }
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

const domainOf = (url) => {
  try {
    return new URL(
      /^https?:/.test(url) ? url : `https://${url}`,
    ).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

// How a handle reads: "@ewarren", "@user@instance", "@name.bsky.social". A YouTube channel ID
// isn't readable, so it's just "channel".
const handleText = ({ network, handle }) => {
  if (network === 'youtube' && !handle.startsWith('@')) {
    return 'channel';
  }
  return `@${handle.replace(/^@/, '')}`;
};

// "https://en.wikipedia.org/wiki/David_Pearce_(philosopher)" -> "David Pearce (philosopher)"
const articleTitle = (url) => {
  try {
    return decodeURIComponent(
      new URL(url).pathname.replace(/^\/wiki\//, ''),
    ).replace(/_/g, ' ');
  } catch {
    return url;
  }
};

/**
 * The rows for "Accounts", like the page's other label and value rows: the entity's own
 * accounts ("Twitter · @SenWarren") and its other websites ("website · elizabethwarren.com",
 * leaving out the main one, which is under Identifiers).
 * @param {Object} entity
 * @returns {{label: string, value: string, href: string}[]}
 */
export function accountRows(entity) {
  const mainSite = entity.ids?.website ? domainOf(entity.ids.website) : null;
  const order = Object.keys(NETWORK_LABELS);
  return [...(entity.accounts || [])]
    .sort((a, b) => order.indexOf(a.network) - order.indexOf(b.network))
    .flatMap((account) => {
      const href = getSocialLinkFromHandle(account.handle, account.network);
      if (account.network === 'website') {
        const domain = domainOf(account.handle);
        return domain === mainSite
          ? []
          : [{ label: 'website', value: domain, href }];
      }
      return [
        {
          label: NETWORK_LABELS[account.network] || account.network,
          value: handleText(account),
          href,
        },
      ];
    });
}

/**
 * The rows for "Elsewhere": pages about the entity on other sites, yours ("Tech Influence Watch
 * · Fairshake") and then its Wikipedia article ("Wikipedia · Fairshake").
 * @param {Object} entity
 * @returns {{label: string, value: string, href: string}[]}
 */
export function elsewhereRows(entity) {
  // Like the Wikipedia row: the site, then the entity's page there ("Tech Influence Watch ·
  // Fairshake"). The link's label names the site; without one, its domain does.
  const yours = (entity.elsewhere || []).map((link) => ({
    label: link.label || domainOf(link.url),
    value: entity.name,
    href: link.url,
  }));
  const wikipedia = entity.ids?.wikipedia
    ? [
        {
          label: 'Wikipedia',
          value: articleTitle(entity.ids.wikipedia),
          href: entity.ids.wikipedia,
        },
      ]
    : [];
  return [...yours, ...wikipedia];
}

/**
 * The facts particular to the entity's type, for "At a glance".
 * @param {Object} entity
 * @returns {{label: string, value: string, href?: string}[]}
 */
export function typeFacts(entity) {
  switch (entity.type) {
    case 'project':
      return [{ label: 'launched', value: month(entity.launchedAt) }];
    case 'bill':
      return [{ label: 'chamber', value: entity.chamber }];
    case 'case':
      return [{ label: 'filed', value: day(entity.filedAt) }];
    case 'enforcement':
      return [
        { label: 'date', value: day(entity.date) },
        {
          label: 'outcome',
          value:
            [entity.outcome?.kind, formatUsd(entity.outcome?.amountUsd)]
              .filter(Boolean)
              .join(' · ') || null,
        },
        { label: 'release', value: entity.releaseNumber },
      ];
    case 'event': {
      const start = formatPartialDate(entity.startDate);
      const end = formatPartialDate(entity.endDate);
      return [
        {
          label: 'dates',
          value:
            start && end && start !== end
              ? `${start} – ${end}`
              : start || end || null,
        },
        ...(entity.amounts || []).map((amount) => ({
          label: amount.label,
          value: formatUsd(amount.amountUsd),
        })),
      ];
    }
    default:
      return [];
  }
}

/**
 * Former names, for a line under the name: "formerly Facebook (until Oct 2021)".
 * @param {Object} entity
 * @returns {?string}
 */
export function formerNames(entity) {
  const names = (entity.aliases || [])
    .filter((alias) => alias.kind === 'former' && alias.name)
    .map((alias) =>
      alias.until ? `${alias.name} (until ${month(alias.until)})` : alias.name,
    );
  return names.length ? `formerly ${names.join(', ')}` : null;
}
