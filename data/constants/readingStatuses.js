const BASE_READING_STATUSES_LIST = [
  { text: 'currently reading', value: 'currentlyReading' },
  { text: 'read', value: 'read' },
  { text: 'reference', value: 'reference' },
  { text: 'shelved', value: 'shelved' },
  { text: 'to read', value: 'toRead' },
];

const READING_STATUSES_MAP = BASE_READING_STATUSES_LIST.reduce(
  (acc, status) => {
    acc[status.value] = status.text;
    return acc;
  },
  {}
);

const READING_LIST_WITHOUT_REFERENCE = BASE_READING_STATUSES_LIST.filter(
  (status) => status.value !== 'reference'
);

// Only want to include "reference" for the Wikipedia list, since I don't really read books in this
// way for pleasure or work
const READING_STATUSES_LISTS = {
  work: READING_LIST_WITHOUT_REFERENCE,
  pleasure: READING_LIST_WITHOUT_REFERENCE,
  wikipedia: BASE_READING_STATUSES_LIST,
};

module.exports = { READING_STATUSES_LISTS, READING_STATUSES_MAP };
