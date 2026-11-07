// How copyToSite.js reshapes old documents. Kept separate so they can be tested without
// running the copy.

// relatedPost/relatedPostModel (one article or press piece) became a list.
export function transformMicroEntry({ relatedPost, relatedPostModel, ...doc }) {
  return {
    ...doc,
    relatedPosts: relatedPost
      ? [{ ref: relatedPost, model: relatedPostModel }]
      : [],
  };
}

// Old press entries record the medium in parenthetical ("Podcast", "Radio show", "in German").
// Language notes and anything unrecognized count as articles; parenthetical itself is kept.
export function pressKind(parenthetical) {
  const text = (parenthetical || '').toLowerCase();
  if (text.includes('podcast')) {
    return 'podcast';
  }
  if (text.includes('radio')) {
    return 'radio';
  }
  if (text.includes('television') || /\btv\b/.test(text)) {
    return 'tv';
  }
  if (text.includes('video')) {
    return 'video';
  }
  if (text === 'talk') {
    return 'talk';
  }
  return 'article';
}

export function transformPressEntry(doc) {
  return { ...doc, kind: pressKind(doc.parenthetical) };
}
