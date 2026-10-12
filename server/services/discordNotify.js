'use strict';

const env = require('../../config/env');
const site = require('../../config/site');
const discord = require('./discord');
const logger = require('./logger');
const { Settings, Discipline } = require('../models');

async function cfg() {
  let s = null;
  try {
    s = await Settings.getInstance();
  } catch (err) {
    s = null;
  }
  const pick = (key, fallback) => (s && s[key]) || fallback || '';
  return {
    ordersChannelId: pick('ordersChannelId', env.discord.ordersChannelId),
    internalOrdersChannelId: pick('internalOrdersChannelId', env.discord.internalOrdersChannelId),
    operationsChannelId: pick('operationsChannelId', env.discord.operationsChannelId),
    disciplineChannelId: pick('disciplineChannelId', env.discord.disciplineChannelId),
    staffRoleId: pick('staffRoleId', env.discord.staffRoleId),
    warnRoleId: pick('warnRoleId', env.discord.warnRoleId),
    fineRoleId: pick('fineRoleId', env.discord.fineRoleId)
  };
}

const money = (n) => {
  const cur = (site.locale && site.locale.currency) || '$';
  return `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${cur}`;
};

const safe = (text, max) => String(text || '').slice(0, max);

function orderEmbed(order, user, internal) {
  const lines = (order.items || []).map((i) => (internal ? `• ${i.qty}× ${i.name}` : `• ${i.qty}× ${i.name} — ${money(i.price * i.qty)}`));
  const fields = [{ name: 'العميل', value: safe(`<@${user.discordId}> (${user.displayName()})`, 256), inline: true }];
  if (!internal) fields.push({ name: 'رقم الراديو', value: safe(order.ingameId || '—', 64), inline: true });
  fields.push({ name: 'المنتجات', value: safe(lines.join('\n') || '—', 1000) });
  if (!internal) fields.push({ name: 'الإجمالي', value: money(order.total), inline: true });
  if (order.note) fields.push({ name: 'ملاحظة', value: safe(order.note, 500) });
  return {
    title: internal ? '📦 طلب جديد من متجر الأعضاء' : '🛒 طلب جديد في المتجر',
    color: internal ? 0x10b981 : 0xd4af37,
    fields,
    footer: { text: `طلب #${String(order._id).slice(-6)}` },
    timestamp: new Date().toISOString()
  };
}

async function notifyNewOrder(order, user, { internal = false } = {}) {
  try {
    if (!env.discord.configured) return false;
    const c = await cfg();
    const channel = internal ? c.internalOrdersChannelId || c.ordersChannelId : c.ordersChannelId;
    if (!channel) return false;
    const body = { embeds: [orderEmbed(order, user, internal)], allowed_mentions: { parse: [] } };
    if (c.staffRoleId) {
      body.content = `<@&${c.staffRoleId}> وصل طلب جديد`;
      body.allowed_mentions = { parse: [], roles: [c.staffRoleId] };
    }
    return await discord.sendChannelMessage(channel, body);
  } catch (err) {
    logger.error('order notify failed:', err.message);
    return false;
  }
}

function linesText(lines) {
  return (lines || []).map((l) => `• ${l.qty}× ${l.name}`).join('\n');
}

async function notifyOperation(op) {
  try {
    if (!env.discord.configured) return false;
    const c = await cfg();
    if (!c.operationsChannelId) return false;
    const url = `${env.baseUrl}/#/operations/${op.id}`;
    const resultLabel = (site.statuses.opResult && site.statuses.opResult[op.result]) || op.result;
    const fields = [
      { name: 'النوع', value: safe(op.typeLabel || '—', 100), inline: true },
      { name: 'النتيجة', value: safe(resultLabel, 50), inline: true },
      { name: 'الربح', value: money(op.winTotal), inline: true },
      { name: 'الخسارة', value: money(op.lossTotal), inline: true }
    ];
    if (op.lostItems && op.lostItems.length) fields.push({ name: 'الأسلحة والأصناف الخاسرة', value: safe(linesText(op.lostItems), 1000) });
    if (op.wonItems && op.wonItems.length) fields.push({ name: 'الأصناف الرابحة', value: safe(linesText(op.wonItems), 1000) });
    if (op.participants && op.participants.length) {
      fields.push({ name: `المشاركون (${op.participants.length})`, value: safe(op.participants.map((p) => p.name).join('، '), 1000) });
    }
    fields.push({ name: 'الرابط', value: `[فتح العملية في الموقع](${url})` });
    const body = {
      embeds: [{ title: `⚔️ عملية جديدة: ${safe(op.title, 200)}`, url, color: 0xef4444, fields, timestamp: new Date().toISOString() }],
      allowed_mentions: { parse: [] }
    };
    return await discord.sendChannelMessage(c.operationsChannelId, body);
  } catch (err) {
    logger.error('operation notify failed:', err.message);
    return false;
  }
}

async function notifyDiscipline(record, target, actor) {
  try {
    if (!env.discord.configured) return false;
    if (record.kind !== 'warning' && record.kind !== 'fine') return false;
    const c = await cfg();
    const roleId = record.kind === 'warning' ? c.warnRoleId : c.fineRoleId;
    if (roleId) await discord.addRole(target.discordId, roleId);
    if (!c.disciplineChannelId) return false;
    const label = site.statuses.disciplineKinds[record.kind] || record.kind;
    const fields = [{ name: 'السبب', value: safe(record.text, 1000) }];
    if (record.kind === 'fine') fields.push({ name: 'مبلغ الغرامة', value: money(record.amount), inline: true });
    if (actor) fields.push({ name: 'بواسطة', value: safe(actor.displayName(), 100), inline: true });
    const body = {
      content: `<@${target.discordId}>`,
      embeds: [
        {
          title: record.kind === 'warning' ? '⚠️ إنذار جديد' : '💸 غرامة جديدة',
          description: `<@${target.discordId}> تم تسجيل **${label}** عليك.`,
          color: record.kind === 'warning' ? 0xf59e0b : 0xef4444,
          fields,
          timestamp: new Date().toISOString()
        }
      ],
      allowed_mentions: { parse: [], users: [target.discordId] }
    };
    return await discord.sendChannelMessage(c.disciplineChannelId, body);
  } catch (err) {
    logger.error('discipline notify failed:', err.message);
    return false;
  }
}

async function clearDisciplineRole(target, kind) {
  try {
    if (!env.discord.configured || (kind !== 'warning' && kind !== 'fine')) return false;
    const left = await Discipline.countDocuments({ user: target._id, kind });
    if (left > 0) return false;
    const c = await cfg();
    const roleId = kind === 'warning' ? c.warnRoleId : c.fineRoleId;
    if (!roleId) return false;
    return await discord.removeRole(target.discordId, roleId);
  } catch (err) {
    logger.error('discipline role clear failed:', err.message);
    return false;
  }
}

module.exports = { notifyNewOrder, notifyOperation, notifyDiscipline, clearDisciplineRole, orderEmbed };
