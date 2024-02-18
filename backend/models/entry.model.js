export const EntrySchema = {
  title: { type: String, required: true },
  author: String,
  date: { type: String, required: true, match: /^\d{4}(-\d{2}){0,2}$/ },
  work: String,
  publisher: String,
  workItalics: Boolean,
  preposition: String,
  parenthetical: String,
  href: { type: String, match: /^https?/ },
  tags: [String],
  entryAdded: Date,
};

export const ShortformSchema = {
  ...EntrySchema,
  started: { type: String, required: true, match: /^\d{4}(-\d{2}){0,2}$/ },
  completed: { type: String, required: false, match: /^\d{4}(-\d{2}){0,2}$/ },
  status: {
    type: String,
    enum: ['read', 'currentlyReading', 'reference', 'shelved', 'toRead'],
  },
  relatedReading: [String],
};
