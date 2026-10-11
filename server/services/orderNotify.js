'use strict';

const env = require('../../config/env');
const site = require('../../config/site');
const discord = require('./discord');
const logger = require('./logger');
const { Settings } = require('../models');

async function channelId() {
  try {
    const s = await Settings.getInstance();
    if (s.ordersChannelId) return s.ordersChannelId;
  } catch (err) {
    // fall back to the environment variable
  }
  return env.discord.ordersChannelId || '';
}

function buildEmbed(order, user) {
  const cur = (site.locale && site.locale.currency) || '$';
  const fmt = (n) => `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${cur}`;
  const lines = (order.items || []).map((i) => `• ${i.qty}× ${i.name} — ${fmt(i.price * i.qty)}`);
  const fields = [
    { name: 'العميل', value: `<@${user.discordId}> (${user.displayName()})`.slice(0, 256), inline: true },
    { name: 'الرقم داخل اللعبة', value: String(order.ingameId || '—').slice(0, 64), inline: true },
    { name: 'المنتجات', value: (lines.join('\n') || '—').slice(0, 1000) },
    { name: 'الإجمالي', value: fmt(order.total), inline: true }
  ];
  if (order.note) fields.push({ name: 'ملاحظة', value: String(order.note).slice(0, 500) });
  return {
    title: '🛒 طلب جديد في المتجر',
    color: 0xd4af37,
    fields,
    footer: { text: `طلب #${String(order._id).slice(-6)}` },
    timestamp: new Date().toISOString()
  };
}

async function notifyNewOrder(order, user) {
  try {
    if (!env.discord.configured) return false;
    const id = await channelId();
    if (!id) return false;
    return await discord.sendChannelMessage(id, { embeds: [buildEmbed(order, user)], allowed_mentions: { parse: [] } });
  } catch (err) {
    logger.error('order notify failed:', err.message);
    return false;
  }
}

module.exports = { notifyNewOrder, buildEmbed };
