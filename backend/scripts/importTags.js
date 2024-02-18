const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = `mongodb+srv://reading-list:${process.env.PASSWORD}@cluster0.ptjwk.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: ServerApiVersion.v1,
});

async function write(collectionName) {
  try {
    await client.connect();
    await client.db('reading-list').collection(`${collectionName}Tags`).drop();

    const collection = client
      .db('reading-list')
      .collection(`${collectionName}Tags`);

    const tags = {};

    const rawData = fs.readFileSync(
      path.join(__dirname, `../../dynamic-website/data/${collectionName}.json`),
    );
    const data = JSON.parse(rawData);
    for (const ind in data) {
      if ('tags' in data[ind]) {
        for (const tag of data[ind].tags) {
          if (tag in tags) {
            tags[tag].frequency = tags[tag].frequency + 1;
          } else {
            tags[tag] = {
              frequency: 1,
              value: tag,
              text: tag.replace(/_/g, ' '),
            };
          }
        }
      }
    }

    const vals = Object.keys(tags).map((k) => tags[k]);
    await collection.insertMany(vals);
  } catch (err) {
    console.log(err);
  } finally {
    client.close();
  }
}

write(process.argv[2]);
