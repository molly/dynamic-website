export function getReadingDetails(feedEntry) {
  const entry = feedEntry.shortform || feedEntry.blockchain || feedEntry.book;
  if ('book' in feedEntry) {
    const details = { icon: 'book' };
    switch (entry.status) {
      case 'read':
        details.verb = 'Finished reading';
        break;
      case 'currentlyReading':
        details.verb = 'Started reading';
        break;
      case 'dnf':
        details.verb = 'Stopped reading';
        break;
      case 'reference':
        details.verb = 'Referenced';
        break;
      default:
        details.verb = 'Read';
    }
    return details;
  }

  const parenthetical = entry.parenthetical
    ? entry.parenthetical.toLowerCase()
    : null;
  if (parenthetical) {
    if (parenthetical.indexOf('video') > -1) {
      return { icon: 'tv', verb: 'Watched' };
    } else if (parenthetical.indexOf('podcast') > -1) {
      return { icon: 'speaker', verb: 'Listened to' };
    }
  }
  return { icon: 'newspaper', verb: 'Read' };
}
