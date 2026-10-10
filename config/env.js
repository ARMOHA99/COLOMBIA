'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const IS_PROD = process.env.NODE_ENV === 'production';
const bool = (v, d = false) => (v === undefined || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));

const env = {
  isProd: IS_PROD,
  port: parseInt(process.env.PORT || '3000', 10),
  baseUrl: (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, ''),
  sessionSecret: process.env.SESSION_SECRET || 'insecure-dev-secret-change-me',
  logLevel: process.env.LOG_LEVEL || 'info',
  buildId: process.env.BUILD_ID || '',

  mongo: {
    uri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/colombia'
  },

  discord: {
    clientId: process.env.DISCORD_CLIENT_ID || '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || '',
    token: process.env.DISCORD_TOKEN || '',
    guildId: process.env.DISCORD_GUILD_ID || '',
    redirectUri: `${(process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '')}/api/auth/callback`,
    scopes: ['identify', 'guilds.members.read']
  },

  roles: {
    admin: process.env.ROLE_ADMIN_ID || '',
    ops: process.env.ROLE_OPS_ID || '',
    member: process.env.ROLE_MEMBER_ID || '',
    shop: process.env.ROLE_SHOP_ID || ''
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || ''
  },

  security: {
    cookiesSecure: bool(process.env.COOKIE_SECURE, IS_PROD),
    reconcileMs: 5 * 60 * 1000,
    sessionTtlMs: 7 * 24 * 60 * 60 * 1000,
    maxUploadBytes: 2 * 1024 * 1024
  }
};

env.discord.configured = Boolean(env.discord.clientId && env.discord.clientSecret && env.discord.token && env.discord.guildId);
env.cloudinary.configured = Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);

env.discord.oauthUrl = () => {
  const p = new URLSearchParams({
    client_id: env.discord.clientId,
    response_type: 'code',
    redirect_uri: env.discord.redirectUri,
    scope: env.discord.scopes.join(' '),
    prompt: 'none'
  });
  return `https://discord.com/oauth2/authorize?${p.toString()}`;
};

module.exports = env;
