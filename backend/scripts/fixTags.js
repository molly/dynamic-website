import { MongoClient, ServerApiVersion } from 'mongodb';

const uri = `mongodb+srv://reading-list:${process.env.PASSWORD}@cluster0.ptjwk.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: ServerApiVersion.v1,
});

const COLLECTIONS = ['shortform', 'blockchain', 'press'];

async function fixTags() {
  try {
    await client.connect();
    for (let collectionName of COLLECTIONS) {
      const collection = await client
        .db('reading-list')
        .collection(`${collectionName}Tags`);

      const distinctCursor = await collection.distinct('text');
      for await (const val of distinctCursor) {
        const cursor = collection.find({ text: val });
        const tags = await cursor.lean();
        if (tags.length > 1) {
          let primaryIndex = 0;
          let toDeleteIndex = 0;
          if (tags[0].value.includes(' ')) {
            primaryIndex = 1;
            toDeleteIndex = 0;
          } else {
            primaryIndex = 0;
            toDeleteIndex = 1;
          }
          const frequency = tags[0].frequency + tags[1].frequency;
          await collection.updateOne(
            { _id: tags[primaryIndex]._id },
            { $set: { frequency: frequency } },
          );
          await collection.deleteOne({ _id: tags[toDeleteIndex]._id });
        } else if (tags[0].value.includes(' ') || tags[0].value.includes('-')) {
          await collection.updateOne(
            { _id: tags[0]._id },
            { $set: { value: tags[0].value.replace(/[- ]/g, '_') } },
          );
        }
      }
    }
    console.log('done');
  } catch (err) {
    console.log(err);
  } finally {
    client.close();
  }
}

async function fixCollectionTags() {
  try {
    await client.connect();
    for (let collectionName of COLLECTIONS) {
      const collection = await client
        .db('reading-list')
        .collection(collectionName);

      const distinctCursor = await collection.distinct('_id');
      for await (const id of distinctCursor) {
        const doc = await collection.findOne({ _id: id });
        if (
          doc.tags &&
          doc.tags.some((tag) => tag.includes(' ') || tag.includes('-'))
        ) {
          const newTags = doc.tags.map((tag) => tag.replace(/[- ]/g, '_'));
          await collection.updateOne({ _id: id }, { $set: { tags: newTags } });
        }
      }
    }
    console.log('done');
  } catch (err) {
    console.log(err);
  } finally {
    client.close();
  }
}

fixTags();
fixCollectionTags();
