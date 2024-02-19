import mongoose from 'mongoose';
import passportLocalMongoose from 'passport-local-mongoose';
import db from './db.js';

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
});

UserSchema.plugin(passportLocalMongoose);

export default db.authConnection.model('User', UserSchema);
