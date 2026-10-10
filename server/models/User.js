'use strict';

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    discordId: { type: String, required: true, unique: true, index: true },
    username: { type: String, default: '' },
    globalName: { type: String, default: '' },
    avatar: { type: String, default: '' },
    roles: { type: [String], default: [] },
    rank: { type: String, enum: ['guest', 'shop', 'member', 'ops', 'admin'], default: 'guest', index: true },
    inGameId: { type: String, default: '' },
    balance: { type: Number, default: 0, min: -1000000 },
    banned: { type: Boolean, default: false },
    banReason: { type: String, default: '' },
    rolesCheckedAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    joinedAt: { type: Date, default: Date.now },
    firstLoginAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

userSchema.methods.avatarUrl = function avatarUrl(size = 64) {
  if (!this.avatar) return `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(this.discordId || '0') >> 22n) % 6}.png`;
  const ext = this.avatar.startsWith('a_') ? 'gif' : 'png';
  return `https://cdn.discordapp.com/avatars/${this.discordId}/${this.avatar}.${ext}?size=${size}`;
};

userSchema.methods.displayName = function displayName() {
  return this.globalName || this.username || this.discordId;
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
