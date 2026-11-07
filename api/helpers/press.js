// How a press entry reads in the feed: "Quoted in: “Title” by …". Your role, when it's set, says
// more than the medium does.

const ROLE_VERBS = {
  quoted: 'Quoted in',
  cited: 'Cited in',
  interviewed: 'Interviewed in',
  profiled: 'Profiled in',
};

const KIND_DETAILS = {
  article: { icon: 'newspaper', verb: 'In the press' },
  freelance: { icon: 'newspaper', verb: 'Wrote' },
  podcast: { icon: 'speaker', verb: 'Appeared on' },
  radio: { icon: 'speaker', verb: 'Appeared on' },
  video: { icon: 'tv', verb: 'Appeared in' },
  tv: { icon: 'tv', verb: 'Appeared on' },
  talk: { icon: 'chat', verb: 'Spoke at' },
};

/**
 * Icon and verb for a press entry.
 * @param {{kind?: string, role?: string}} press
 * @returns {{icon: string, verb: string}}
 */
export function getPressDetails(press) {
  const details = KIND_DETAILS[press.kind] || KIND_DETAILS.article;
  return { icon: details.icon, verb: ROLE_VERBS[press.role] || details.verb };
}
