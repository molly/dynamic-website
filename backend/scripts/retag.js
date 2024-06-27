import readline from 'node:readline';
import db from '../models/db.js';
import { PressEntry } from '../models/entry.model.js';
import { Tag } from '../models/tag.model.js';

async function migrate() {
  await db.initialize();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  function ask(questionText) {
    return new Promise((resolve) => {
      rl.question(questionText, resolve);
    });
  }

  const press = await PressEntry.find()
    .sort({ date: -1 })
    .populate({
      path: 'tags',
      model: Tag,
      options: { sort: { value: 1 } },
    });

  for (const entry of press) {
    console.log(entry.title);
    console.log(entry.tags.map((tag) => tag.value).join(', '));
    const tagsStr = await ask('New tags: ');
    if (tagsStr === '') {
      continue;
    }

    const tags = tagsStr.split(',').map((tag) => tag.trim());
    const tagObjects = [];
    for (const tag of tags) {
      console.log(tag);
      let tagObject = await Tag.findOne({ value: tag });
      if (!tagObject) {
        tagObject = new Tag({
          text: tag.replace('_', ' '),
          value: tag,
          frequency: {
            shortform: 0,
            blockchain: 0,
            micro: 0,
            citationNeeded: 0,
            press: 1,
            total: 1,
          },
        });
        const newTag = await tagObject.save();
        console.log('Created new tag:', newTag.value, newTag.text);
      } else {
        tagObject.frequency.press += 1;
        tagObject.frequency.total += 1;
        await tagObject.save();
      }
      tagObjects.push(tagObject);
    }
    entry.tags = entry.tags.concat(tagObjects);
    const result = await entry.save();
    console.log('Saved tags:', result.tags.map((tag) => tag.text).join(', '));
  }

  await db.gracefulClose();
  return;
}

migrate();
