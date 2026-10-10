'use strict';

const site = require('../../config/site');
const { User } = require('../models');
const rolesSvc = require('../services/roles');
const logger = require('../services/logger');

async function loadSessionUser(req, res, next) {
  req.user = null;
  if (!req.session || !req.session.userId) return next();
  try {
    const user = await User.findById(req.session.userId);
    if (!user) {
      return req.session.destroy(() => next());
    }
    req.user = user;
    rolesSvc.registry.register(user.discordId, req.sessionID);
    return next();
  } catch (err) {
    logger.error('loadSessionUser:', err.message);
    return next();
  }
}

function killSession(req) {
  const sid = req.sessionID;
  const discordId = req.session ? req.session.discordId : null;
  return new Promise((resolve) => {
    req.session.destroy(() => {
      if (discordId) rolesSvc.registry.unregister(discordId, sid);
      resolve();
    });
  });
}

async function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: site.strings.errors.unauthorized, code: 'UNAUTHENTICATED' });
  }
  if (!req.user) {
    await killSession(req);
    return res.status(401).json({ error: site.strings.auth.sessionExpired, code: 'UNAUTHENTICATED' });
  }
  if (req.user.banned) {
    await killSession(req);
    return res.status(403).json({ error: req.user.banReason || site.strings.errors.forbidden, code: 'BANNED' });
  }

  const fresh = await rolesSvc.ensureFreshRoles(req.user);
  if (!fresh || fresh.rank === 'guest') {
    await killSession(req);
    return res.status(401).json({ error: site.strings.auth.kicked, code: 'REVOKED' });
  }
  req.user = fresh;
  req.userRank = fresh.rank;
  req.userRankValue = rolesSvc.rankValue(fresh.rank);
  rolesSvc.registry.register(fresh.discordId, req.sessionID);
  return next();
}

function requireRank(minRank) {
  const min = rolesSvc.rankValue(minRank);
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: site.strings.errors.unauthorized, code: 'UNAUTHENTICATED' });
    }
    if ((req.userRankValue || rolesSvc.rankValue(req.user.rank)) < min) {
      return res.status(403).json({ error: site.strings.errors.forbidden, code: 'FORBIDDEN' });
    }
    return next();
  };
}

module.exports = { loadSessionUser, requireAuth, requireRank, killSession };
