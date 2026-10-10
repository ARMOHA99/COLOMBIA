'use strict';

const router = require('express').Router();
const site = require('../../config/site');
const env = require('../../config/env');
const build = require('../services/build');
const { Settings } = require('../models');
const { asyncHandler } = require('../middleware/errors');

router.get(
  '/site',
  asyncHandler(async (req, res) => {
    let runtime = null;
    try {
      const s = await Settings.getInstance();
      runtime = {
        siteName: s.siteName,
        siteTagline: s.siteTagline,
        logoUrl: s.logoUrl || '',
        motd: s.motd,
        lockoutEnabled: s.lockoutEnabled,
        lockoutStart: s.lockoutStart,
        lockoutEnd: s.lockoutEnd,
        categories: s.categories,
        treasuryCategories: s.treasuryCategories,
        shopNotice: s.shopNotice,
        maintenance: s.maintenance
      };
    } catch {
      runtime = null;
    }
    res.json({
      version: site.version,
      org: site.org,
      locale: site.locale,
      theme: site.theme,
      ranks: site.ranks,
      nav: site.nav,
      routesByRank: site.routesByRank,
      strings: site.strings,
      statuses: site.statuses,
      defaults: site.defaults,
      buildId: build.getBuildId(),
      configured: { discord: env.discord.configured, cloudinary: env.cloudinary.configured },
      runtime
    });
  })
);

router.get('/build', (req, res) => res.json({ buildId: build.getBuildId() }));
router.get('/health', (req, res) => res.json({ ok: true, uptime: Math.round(process.uptime()), buildId: build.getBuildId() }));

router.use('/auth', require('./auth'));
router.use('/dashboard', require('./dashboard'));
router.use('/attendance', require('./attendance'));
router.use('/operations', require('./operations'));
router.use('/farm', require('./farm'));
router.use('/treasury', require('./treasury'));
router.use('/discipline', require('./discipline'));
router.use('/tickets', require('./tickets'));
router.use('/shop', require('./shop'));
router.use('/internal', require('./internalShop'));
router.use('/leaderboard', require('./leaderboard'));
router.use('/admin', require('./admin'));

module.exports = router;
