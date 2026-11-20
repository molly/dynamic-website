import { jest } from '@jest/globals';

// Stand-ins for the Tag and BookTag models, counting their loads. Like a Mongoose query, find()
// runs only once, when exec() is called; awaiting it more than once is an error.
const fakeModel = (modelName, tags) => {
  const model = {
    modelName,
    tags,
    loads: 0,
    fail: false,
    find: () => {
      let executed = false;
      const exec = () => {
        if (executed) {
          return Promise.reject(new Error('Query was already executed'));
        }
        executed = true;
        model.loads += 1;
        return model.fail
          ? Promise.reject(new Error('down'))
          : Promise.resolve(structuredClone(model.tags));
      };
      const query = {
        lean: () => query,
        exec,
        then: (resolve, reject) => exec().then(resolve, reject),
        catch: (reject) => exec().catch(reject),
      };
      return query;
    },
  };
  return model;
};

const Tag = fakeModel('Tag', [
  { _id: 'a', value: 'ai', frequency: { shortform: 2, press: 0, total: 2 } },
  { _id: 'b', value: 'crypto', frequency: { shortform: 5, press: 1, total: 6 } },
  { _id: 'c', value: 'law', frequency: { press: 3, total: 3 } },
]);
const BookTag = fakeModel('BookTag', [
  { _id: 'x', value: 'history', frequency: { total: 4 } },
  { _id: 'y', value: 'unused', frequency: { total: 0 } },
]);

jest.unstable_mockModule('../../../backend/models/tag.model.js', () => ({
  Tag,
  BookTag,
}));

const {
  getAllTags,
  getTagsByFrequency,
  getTagsByValue,
  invalidateTagCache,
} = await import('../../../backend/helpers/tagCache.js');

beforeEach(() => {
  invalidateTagCache();
  Tag.loads = 0;
  BookTag.loads = 0;
  Tag.fail = false;
  jest.useRealTimers();
});

describe('the tag cache', () => {
  it('loads each model once for any number of requests, including concurrent ones', async () => {
    await Promise.all([getAllTags(), getAllTags(), getTagsByValue(['ai'])]);
    await getTagsByFrequency('shortform');
    await getAllTags({ book: true });
    expect(Tag.loads).toBe(1);
    expect(BookTag.loads).toBe(1);
  });

  it('loads again once invalidated', async () => {
    await getAllTags();
    invalidateTagCache();
    await getAllTags();
    expect(Tag.loads).toBe(2);
  });

  it('loads again once five minutes old', async () => {
    jest.useFakeTimers({ now: 0 });
    await getAllTags();
    jest.setSystemTime(4 * 60 * 1000);
    await getAllTags();
    expect(Tag.loads).toBe(1);
    jest.setSystemTime(5 * 60 * 1000);
    await getAllTags();
    expect(Tag.loads).toBe(2);
  });

  it('lists the tags used in a category, most used first', async () => {
    expect((await getTagsByFrequency('shortform')).map((t) => t.value)).toEqual(
      ['crypto', 'ai'],
    );
    expect((await getTagsByFrequency('press')).map((t) => t.value)).toEqual([
      'law',
      'crypto',
    ]);
    expect(
      (await getTagsByFrequency('total', { book: true })).map((t) => t.value),
    ).toEqual(['history']);
  });

  it('finds tags by value', async () => {
    expect(
      (await getTagsByValue(['law', 'ai', 'nope'])).map((t) => t._id),
    ).toEqual(['a', 'c']);
    expect(await getTagsByValue(['ai'], { book: true })).toEqual([]);
  });

  it("doesn't let one caller's changes reach the next", async () => {
    const [first] = await getAllTags();
    first.value = 'changed';
    first.frequency.total = 99;
    const [again] = await getAllTags();
    expect(again.value).toBe('ai');
    expect(again.frequency.total).toBe(2);
  });

  it("doesn't keep a failed load", async () => {
    Tag.fail = true;
    await expect(getAllTags()).rejects.toThrow('down');
    Tag.fail = false;
    expect(await getAllTags()).toHaveLength(3);
    expect(Tag.loads).toBe(2);
  });
});
