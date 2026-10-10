'use strict';

const env = require('../../config/env');
const site = require('../../config/site');
const { User } = require('../models');
const discord = require('./discord');
const bus = require('./bus');
const logger = require('./logger');
const { logAudit } = require('./audit');

const RANK_ORDER = { guest: 0, shop: 1, member: 2, ops: 3, admin: 4 };

const registry = {
  map: new Map(),
  store: null,
  init(store) {
    this.store = store;
  },
  register(discordId, sid) {
    if (!discordId || !sid) return;
    if (!this.map.has(discordId)) this.map.set(discordId, new Set());
    this.map.get(discordId).add(sid);
  },
  unregister(discordId, sid) {
    const set = this.map.get(discordId);
    if (!set) return;
    set.delete(sid);
    if (!set.size) this.map.delete(discordId);
  },
  async revoke(discordId) {
    const set = this.map.get(discordId);
    if (!set || !this.store) return 0;
    let killed = 0;
    for (const sid of [...set]) {
      try {
        await this.store.destroy(sid);
        killed += 1;
      } catch (err) {
        logger.error('session destroy failed:', err.message);
      }
    }
    this.map.delete(discordId);
    return killed;
  }
};

function rankOf(roleIds) {
  const set = new Set(Array.isArray(roleIds) ? roleIds : []);
  if (env.roles.admin && set.has(env.roles.admin)) return 'admin';
  if (env.roles.ops && set.has(env.roles.ops)) return 'ops';
  if (env.roles.member && set.has(env.roles.member)) return 'member';
  if (env.roles.shop && set.has(env.roles.shop)) return 'shop';
  return 'guest';
}

function rankValue(rank) {
  return RANK_ORDER[rank] !== undefined ? RANK_ORDER[rank] : 0;
}

function hasShopDuty(user) {
  if (!user) return false;
  if (rankValue(user.rank) >= 3) return true;
  return env.roles.shop ? (user.roles || []).includes(env.roles.shop) : user.rank === 'shop';
}

const inflight = new Map();

async function refreshRoles(user, { reason = 'rest-reconcile', actor = null } = {}) {
  if (!user) return null;
  if (!env.discord.configured) {
    user.rolesCheckedAt = new Date();
    return user;
  }
  const key = user.discordId;
  if (inflight.has(key)) return inflight.get(key);

  const job = (async () => {
    try {
      const result = await discord.getMemberRoles(user.discordId);
      if (!result) return user;
      const oldRoles = user.roles || [];
      const oldRank = user.rank;
      const newRank = result.left ? 'guest' : rankOf(result.roles);
      const rolesChanged = JSON.stringify([...oldRoles].sort()) !== JSON.stringify([...(result.roles || [])].sort());

      user.roles = result.roles || [];
      user.rank = newRank;
      user.rolesCheckedAt = new Date();

      if (rolesChanged || oldRank !== newRank) {
        await user.save();
        await logAudit({
          actor: actor || { name: `discord:${reason}` },
          action: 'roles.synced',
          targetType: 'user',
          targetId: user.discordId,
          before: { rank: oldRank, roles: oldRoles },
          after: { rank: newRank, roles: user.roles }
        });
        bus.emit('notify', { room: `user:${user.discordId}`, event: 'user:updated', data: publicUser(user) });

        if (rankValue(newRank) < rankValue(oldRank)) {
          const killed = await registry.revoke(user.discordId);
          const reasonText =
            newRank === 'guest' ? site.strings.auth.kicked : 'تم تعديل رتبتك، يرجى تسجيل الدخول مجدداً.';
          bus.emit('notify', { room: `user:${user.discordId}`, event: 'session:revoked', data: { reason: reasonText } });
          logger.info(`sessions revoked for ${user.discordId} (${oldRank} -> ${newRank}, ${killed})`);
        }
      } else {
        await user.save();
      }
      return user;
    } catch (err) {
      logger.error('refreshRoles failed:', err.message);
      return user;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, job);
  return job;
}

async function ensureFreshRoles(user) {
  if (!user) return null;
  const stale = !user.rolesCheckedAt || Date.now() - new Date(user.rolesCheckedAt).getTime() > env.security.reconcileMs;
  if (!stale) return user;
  return refreshRoles(user);
}

async function reconcileAll() {
  if (!env.discord.configured) return { checked: 0, changed: 0 };
  const members = await discord.fetchAllGuildMembers();
  if (!members) return { checked: 0, changed: 0 };
  const byId = new Map(members.map((m) => [m.user.id, (m.roles || []).map(String)]));
  const users = await User.find({ rank: { $ne: 'guest' } });
  let changed = 0;
  for (const user of users) {
    const remote = byId.get(user.discordId);
    const oldRank = user.rank;
    const newRoles = remote || [];
    const newRank = remote ? rankOf(newRoles) : 'guest';
    const rolesChanged = JSON.stringify([...(user.roles || [])].sort()) !== JSON.stringify([...newRoles].sort());
    if (!rolesChanged && oldRank === newRank && user.rolesCheckedAt && Date.now() - user.rolesCheckedAt.getTime() < env.security.reconcileMs) {
      continue;
    }
    user.roles = newRoles;
    user.rank = newRank;
    user.rolesCheckedAt = new Date();
    await user.save();
    changed += 1;
    await logAudit({
      actor: { name: 'system:reconcile' },
      action: 'roles.reconciled',
      targetType: 'user',
      targetId: user.discordId,
      before: { rank: oldRank },
      after: { rank: newRank }
    });
    bus.emit('notify', { room: `user:${user.discordId}`, event: 'user:updated', data: publicUser(user) });
    if (rankValue(newRank) < rankValue(oldRank)) {
      await registry.revoke(user.discordId);
      bus.emit('notify', {
        room: `user:${user.discordId}`,
        event: 'session:revoked',
        data: { reason: site.strings.auth.kicked }
      });
    }
  }
  for (const [discordId, roles] of byId.entries()) {
    const rank = rankOf(roles);
    if (rank === 'guest') continue;
    const existing = await User.findOne({ discordId });
    if (!existing) continue;
    if (existing.rank !== 'guest') continue;
    existing.roles = roles;
    existing.rank = rank;
    existing.rolesCheckedAt = new Date();
    await existing.save();
    changed += 1;
    bus.emit('notify', { room: `user:${discordId}`, event: 'user:updated', data: publicUser(existing) });
  }
  return { checked: users.length, changed };
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: String(user._id),
    discordId: user.discordId,
    username: user.username,
    globalName: user.globalName,
    displayName: user.displayName(),
    avatar: user.avatarUrl(128),
    rank: user.rank,
    rankLabel: (site.ranks[user.rank] && site.ranks[user.rank].label) || user.rank,
    rankOrder: rankValue(user.rank),
    balance: user.balance,
    inGameId: user.inGameId,
    banned: user.banned,
    roles: user.roles,
    joinedAt: user.joinedAt,
    rolesCheckedAt: user.rolesCheckedAt
  };
}

module.exports = {
  RANK_ORDER,
  rankOf,
  rankValue,
  hasShopDuty,
  registry,
  refreshRoles,
  ensureFreshRoles,
  reconcileAll,
  publicUser
};
