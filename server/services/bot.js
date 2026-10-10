'use strict';

const { Client, GatewayIntentBits, Events } = require('discord.js');
const env = require('../../config/env');
const logger = require('./logger');
const roles = require('./roles');
const { User } = require('../models');

let client = null;

async function handleMemberEvent(discordId, label) {
  try {
    const user = await User.findOne({ discordId });
    if (!user || user.rank === 'guest') return;
    await roles.refreshRoles(user, { reason: label });
  } catch (err) {
    logger.error(`bot[${label}]:`, err.message);
  }
}

async function startBot() {
  if (!env.discord.configured) {
    logger.warn('Discord bot disabled — DISCORD_* / ROLE_* environment variables are incomplete.');
    return null;
  }
  client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
    allowedMentions: { parse: [] }
  });

  client.on(Events.ClientReady, (c) => {
    logger.info(`Discord bot online as ${c.user.tag} (guild: ${env.discord.guildId})`);
  });

  client.on(Events.GuildMemberUpdate, (_old, member) => {
    handleMemberEvent(member.id, 'guildMemberUpdate');
  });

  client.on(Events.GuildMemberRemove, (member) => {
    handleMemberEvent(member.id, 'guildMemberRemove');
  });

  client.on(Events.GuildBanAdd, (ban) => {
    handleMemberEvent(ban.user.id, 'guildBanAdd');
  });

  client.on(Events.Warn, (m) => logger.warn('discord warn:', m));
  client.on(Events.Error, (m) => logger.error('discord error:', m));

  try {
    await client.login(env.discord.token);
  } catch (err) {
    logger.error('Discord bot login failed:', err.message);
    client = null;
    return null;
  }
  return client;
}

function stopBot() {
  if (client) {
    try {
      client.destroy();
    } catch {}
    client = null;
  }
}

module.exports = { startBot, stopBot, getClient: () => client };
