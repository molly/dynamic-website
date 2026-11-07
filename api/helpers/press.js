import { DateTime } from 'luxon';

// How a press entry reads in the feed. The metadata column's verb comes from the medium ("In the
// press", "Published", "Spoke", "Appeared on"); your part in a piece goes in the sentence about
// it ("Quoted in The Atlantic").

const ROLE_PHRASES = {
  quoted: 'Quoted in',
  cited: 'Cited in',
  interviewed: 'Interviewed in',
  profiled: 'Profiled in',
};

const KIND_DETAILS = {
  article: { icon: 'newspaper', verb: 'In the press' },
  freelance: { icon: 'newspaper', verb: 'Published' },
  podcast: { icon: 'speaker', verb: 'Appeared on' },
  radio: { icon: 'speaker', verb: 'Appeared on' },
  video: { icon: 'tv', verb: 'Appeared in' },
  tv: { icon: 'tv', verb: 'Appeared on' },
  talk: { icon: 'chat', verb: 'Spoke' },
};

/**
 * Whether a talk hasn't happened yet: its date is after today (Eastern).
 * @param {{kind?: string, date?: string}} press
 */
export function isUpcoming(press, { now = DateTime.now() } = {}) {
  if (
    press.kind !== 'talk' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(String(press.date || ''))
  ) {
    return false;
  }
  return press.date > now.setZone('America/New_York').toISODate();
}

/**
 * Icon, verb and the phrase for your role, for a press entry.
 * @param {{kind?: string, role?: string, date?: string}} press
 * @returns {{icon: string, verb: string, rolePhrase: ?string}}
 */
export function getPressDetails(press, { now } = {}) {
  const details = KIND_DETAILS[press.kind] || KIND_DETAILS.article;
  return {
    icon: details.icon,
    verb: isUpcoming(press, { now }) ? 'Speaking' : details.verb,
    rolePhrase: ROLE_PHRASES[press.role] || null,
  };
}
