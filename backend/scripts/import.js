const { MongoClient, ServerApiVersion } = require('mongodb');
const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');

const uri = `mongodb+srv://reading-list:${process.env.PASSWORD}@cluster0.ptjwk.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const SAME_MONTH_REGEX = new RegExp(/([A-Za-z]+ \d{1,2})[-–]\d{1,2}(, \d{4})/);
const DIFFERENT_MONTHS_REGEX = new RegExp(
  /([A-Za-z]+ \d{1,2})[-–][A-Za-z]+ \d{1,2}(, \d{4})/
);
function getDateFromWeek(week) {
  const sameMatch = week.match(SAME_MONTH_REGEX);
  if (sameMatch) {
    return DateTime.fromFormat(sameMatch[1] + sameMatch[2], 'LLLL d, yyyy');
  }
  const differentMatch = week.match(DIFFERENT_MONTHS_REGEX);
  if (differentMatch) {
    return DateTime.fromFormat(
      differentMatch[1] + differentMatch[2],
      'LLLL d, yyyy'
    );
  }
  return DateTime.fromISO('1970-01-01');
}

async function write(collectionName) {
  try {
    await client.connect();
    await client.db('reading-list').collection(collectionName).drop();
    const collection = client.db('reading-list').collection(collectionName);
    const rawData = fs.readFileSync(
      path.join(__dirname, `../../dynamic-website/data/${collectionName}.json`)
    );
    const data = JSON.parse(rawData);
    for (const ind in data) {
      if ('week' in data[ind]) {
        const dt = getDateFromWeek(data[ind].week);
        data[ind].started = dt.toISODate();
        delete data[ind].week;
      }
    }

    await collection.insertMany(data);
  } catch (err) {
    console.log(err);
  } finally {
    client.close();
  }
}

write(process.argv[2]);
