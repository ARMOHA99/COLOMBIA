'use strict';

const catalog = require('../../config/permissions');
const { Settings } = require('../models');

const ALL = [...catalog.rooms, ...catalog.actions].map((p) => p.key);
const VALID = new Set(ALL);

const MEMBER = [
  'view.dashboard',
  'view.card',
  'view.attendance',
  'view.operations',
  'view.farm',
  'view.internal',
  'view.discipline',
  'view.tickets',
  'view.leaderboard'
];
const OPS = [
  ...MEMBER,
  'view.presence',
  'view.shop',
  'view.orders',
  'view.treasury',
  'ops.record',
  'farm.manage',
  'treasury.write',
  'orders.handle',
  'discipline.write',
  'tickets.handle',
  'members.view'
];
const BUSINESS = [
  'view.shop',
  'view.orders',
  'orders.handle',
  'view.treasury',
  'treasury.write',
  'view.items',
  'items.write',
  'shop.manage',
  'internal.manage'
];
const SHOP = ['view.shop', 'view.orders', 'orders.handle'];

const BASE = { guest: [], custom: [], shop: SHOP, business: BUSINESS, member: MEMBER, ops: OPS, admin: ALL };

let cache = { list: [], at: 0 };

async function loadCustomRoles() {
  const s = await Settings.getInstance();
  cache = {
    list: (s.customRoles || []).map((r) => ({
      id: String(r.id),
      kind: r.kind === 'user' ? 'user' : 'role',
      label: r.label || '',
      perms: (r.perms || []).filter((p) => VALID.has(p))
    })),
    at: Date.now()
  };
  return cache.list;
}

async function ensureCustomRoles() {
  if (Date.now() - cache.at < 30000) return;
  try {
    await loadCustomRoles();
  } catch (err) {
    cache.at = Date.now();
  }
}

function customRoles() {
  return cache.list;
}

function customMatches(roleIds, discordId) {
  const ids = new Set((roleIds || []).map(String));
  return cache.list.filter((c) => (c.kind === 'user' ? String(discordId || '') === c.id : ids.has(c.id)));
}

function permsOf(user) {
  if (!user) return new Set();
  if (user.rank === 'admin') return new Set(ALL);
  const set = new Set(BASE[user.rank] || []);
  for (const entry of customMatches(user.roles, user.discordId)) {
    for (const p of entry.perms) set.add(p);
  }
  return set;
}

function hasPerm(user, ...perms) {
  const set = permsOf(user);
  return perms.some((p) => set.has(p));
}

module.exports = { ALL, VALID, BASE, catalog, loadCustomRoles, ensureCustomRoles, customRoles, customMatches, permsOf, hasPerm };
