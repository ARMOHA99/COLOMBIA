'use strict';

const router = require('express').Router();
const crypto = require('crypto');
const env = require('../../config/env');
const site = require('../../config/site');
const { User } = require('../models');
const discord = require('../services/discord');
const rolesSvc = require('../services/roles');
const { logAudit } = require('../services/audit');
const build = require('../services/build');
const { asyncHandler, fail } = require('../middleware/errors');
const { requireAuth, killSession } = require('../middleware/auth');
const { authLimiter } = require('../middleware/security');

function regenerate(req) {
  return new Promise((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));
}
function saveSession(req) {
  return new Promise((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));
}
function destroy(req) {
  return new Promise((resolve) => req.session.destroy(() => resolve()));
}

router.get(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    if (!env.discord.configured) throw fail(503, site.strings.errors.discordDown, 'DISCORD_OFF');
    if (!req.session) throw fail(500, site.strings.errors.server, 'SESSION');
    req.session.oauthState = crypto.randomBytes(16).toString('hex');
    await saveSession(req);
    res.redirect(`${env.discord.oauthUrl()}&state=${req.session.oauthState}`);
  })
);

router.get(
  '/callback',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { code, state } = req.query;
    if (!code || !state || !req.session || state !== req.session.oauthState) {
      throw fail(400, site.strings.auth.oauthFailed, 'OAUTH_STATE');
    }
    delete req.session.oauthState;
    await saveSession(req);

    const token = await discord.exchangeCode(String(code));
    if (!token) throw fail(502, site.strings.auth.oauthFailed, 'OAUTH_TOKEN');

    const profile = await discord.fetchOAuthUser(token.access_token);
    if (!profile) throw fail(502, site.strings.auth.oauthFailed, 'OAUTH_PROFILE');

    let member = await discord.fetchOAuthGuildMember(token.access_token);
    if (!member) member = await discord.fetchBotGuildMember(profile.id);
    if (!member) return res.redirect(`${env.baseUrl}/#/login?err=notmember`);

    const roleIds = Array.isArray(member.roles) ? member.roles.map(String) : [];
    const rank = rolesSvc.rankOf(roleIds);

    const user = await User.findOneAndUpdate(
      { discordId: profile.id },
      {
        $set: {
          username: profile.username || '',
          globalName: profile.global_name || profile.username || '',
          avatar: profile.avatar || '',
          roles: roleIds,
          rank,
          rolesCheckedAt: new Date(),
          lastSeenAt: new Date()
        },
        $setOnInsert: { discordId: profile.id, firstLoginAt: new Date(), joinedAt: new Date() }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    if (user.banned) return res.redirect(`${env.baseUrl}/#/login?err=banned`);
    if (rank === 'guest') return res.redirect(`${env.baseUrl}/#/login?err=noaccess`);

    await regenerate(req);
    req.session.userId = String(user._id);
    req.session.discordId = user.discordId;
    req.session.createdAt = Date.now();
    await saveSession(req);

    rolesSvc.registry.register(user.discordId, req.sessionID);
    await logAudit({
      actor: user,
      action: 'auth.login',
      targetType: 'user',
      targetId: user.discordId,
      ip: req.ip
    });

    const route = site.routesByRank[rank] || '#/dashboard';
    return res.redirect(`${env.baseUrl}/${route}`);
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({
      user: rolesSvc.publicUser(req.user),
      route: site.routesByRank[req.user.rank] || '#/dashboard',
      buildId: build.getBuildId()
    });
  })
);

router.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const discordId = req.session && req.session.discordId;
    const sid = req.sessionID;
    if (discordId) {
      await logAudit({ actor: { discordId, name: 'user' }, action: 'auth.logout', targetType: 'user', targetId: discordId, ip: req.ip });
    }
    await destroy(req);
    if (discordId) rolesSvc.registry.unregister(discordId, sid);
    res.json({ ok: true, message: site.strings.auth.loggedOut });
  })
);

module.exports = router;
