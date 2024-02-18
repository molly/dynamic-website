import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import config from '../config/auth.config.js';

const RefreshTokenSchema = new mongoose.Schema({
  token: String,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  expiryDate: Date,
});

RefreshTokenSchema.statics.createToken = async function (user) {
  const expiredAt = new Date();
  expiredAt.setSeconds(expiredAt.getSeconds() + config.refreshTokenExpiry);
  const expiredAtTime = expiredAt.getTime();

  const _token = jwt.sign(
    { id: user._id, exp: expiredAtTime },
    config.refreshSecret,
  );
  const _object = new this({
    token: _token,
    user: user._id,
    expiryDate: expiredAtTime,
  });

  // There should only be one valid refresh token per user at any given time
  await this.deleteMany({ user: user._id });

  const refreshToken = await _object.save();
  return refreshToken.token;
};

RefreshTokenSchema.statics.isExpiredOrInvalid = (token) => {
  jwt.verify(token, config.refreshSecret, (err) => {
    return !!err;
  });
};

const RefreshToken = mongoose.model(
  'RefreshToken',
  RefreshTokenSchema,
  'refreshTokens',
);
export default RefreshToken;
