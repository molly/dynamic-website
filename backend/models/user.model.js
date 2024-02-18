import mongoose from 'mongoose';

const User = mongoose.model(
  'User',
  new mongoose.Schema({
    username: String,
    password: String,
  }),
);

export default User;
