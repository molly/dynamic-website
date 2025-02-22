const BASE_READING_STATUSES_LIST = [
  { text: 'currently reading', value: 'currentlyReading' },
  { text: 'read', value: 'read' },
  { text: 'reference', value: 'reference' },
  { text: 'did not finish', value: 'dnf' },
];

export const READING_STATUSES_MAP = BASE_READING_STATUSES_LIST.reduce(
  (acc, status) => {
    acc[status.value] = status.text;
    return acc;
  },
  {},
);

const READING_LIST_WITHOUT_REFERENCE = BASE_READING_STATUSES_LIST.filter(
  (status) => status.value !== 'reference',
);

// Only want to include "reference" for the non-fiction list
export const READING_STATUSES_LISTS = {
  pleasure: READING_LIST_WITHOUT_REFERENCE,
  reference: BASE_READING_STATUSES_LIST,
};
