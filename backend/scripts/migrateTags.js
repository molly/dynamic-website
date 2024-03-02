import prompt from 'prompt-sync';
import db from '../models/db.js';
import { Tag } from '../models/tag.model.js';

async function migrate() {
  const Prompt = prompt();
  try {
    const tags = await Tag.find();
    for (let tag of tags) {
      console.log(tag.text);
      const newName = Prompt('New name: ');
      if (newName) {
        tag.text = newName;
        await tag.save();
        console.log('SAVED');
      }
    }
    console.log('done');
  } catch (err) {
    console.log(err);
  } finally {
    db.gracefulClose();
  }
}

migrate();
