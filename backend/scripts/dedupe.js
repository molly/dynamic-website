const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = `mongodb+srv://reading-list:${process.env.PASSWORD}@cluster0.ptjwk.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function dedupe() {
  try {
    await client.connect();
    const collection = await client.db('reading-list').collection('press');

    const distinctCursor = await collection.distinct('href');
    for await (const val of distinctCursor) {
      let i = 0;
      const cursor = collection.find({ href: val });
      for await (const doc of cursor) {
        if (i > 0) {
          await collection.deleteOne({ _id: doc._id });
          console.log(`deleting dupe: ${val}`);
        }
        i++;
      }
    }
    console.log('done');
  } catch (err) {
    console.log(err);
  } finally {
    client.close();
  }
}

dedupe();
