const MicroEntrySchema = {
  title: { type: String, required: true },
  slug: { type: String, required: true },
  post: { type: Object, required: true },
  tags: [String],
  relatedPosts: [String],
};

export default MicroEntrySchema;
