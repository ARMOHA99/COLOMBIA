'use strict';

const router = require('express').Router();
const { DutySession, Settings, User } = require('../models');
const time = require('../utils/time');
const { asyncHandler, fail } = require('../middleware/errors');
const { requireAuth, requireRank } = require('../middleware/auth');
const site = require('../../config/site');

router.use(requireAuth, requireRank('member'));

function liveMinutes(session) {
  const end = session.end ? new Date(session.end).getTime() : Date.now();
  return Math.max(0, Math.round((end - new Date(session.start).getTime()) / 60000));
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const settings = await Settings.getInstance();
    const now = new Date();
    const z = time.toZoned(now);
    const todayStart = time.fromZoned(new Date(Date.UTC(z.getUTCFullYear(), z.getUTCMonth(), z.getUTCDate())));
    const week = time.weekBounds();

    const [open, todaySessions, weekSessions, recent, rosterDocs] = await Promise.all([
      DutySession.findOne({ user: req.user._id, open: true }),
      DutySession.find({ user: req.user._id, start: { $gte: todayStart } }),
      DutySession.find({ user: req.user._id, start: { $gte: week.start, $lt: week.end } }),
      DutySession.find({ user: req.user._id }).sort({ start: -1 }).limit(20),
      DutySession.find({ open: true }).populate('user', 'globalName username avatar rank discordId').limit(50)
    ]);

    const sum = (list) => list.reduce((a, s) => a + liveMinutes(s), 0);

    res.json({
      onDuty: Boolean(open),
      since: open ? open.start : null,
      liveMin: open ? liveMinutes(open) : 0,
      todayMin: sum(todaySessions),
      weekMin: sum(weekSessions),
      sessions: recent.map((s) => ({
        id: String(s._id),
        start: s.start,
        end: s.end,
        durationMin: liveMinutes(s),
        open: s.open
      })),
      roster: rosterDocs.map((s) => ({
        user: s.user
          ? {
              id: String(s.user._id),
              name: s.user.displayName(),
              avatar: s.user.avatarUrl ? s.user.avatarUrl(64) : '',
              rank: s.user.rank
            }
          : null,
        since: s.start,
        liveMin: liveMinutes(s)
      })),
      lockout: {
        enabled: settings.lockoutEnabled,
        start: settings.lockoutStart,
        end: settings.lockoutEnd,
        active: settings.lockoutEnabled && time.isLockoutActive(now, settings.lockoutStart, settings.lockoutEnd)
      }
    });
  })
);

router.post(
  '/clock',
  asyncHandler(async (req, res) => {
    const settings = await Settings.getInstance();
    const now = new Date();
    const open = await DutySession.findOne({ user: req.user._id, open: true });

    if (open) {
      open.end = now;
      open.durationMin = liveMinutes(open);
      open.open = false;
      await open.save();
      return res.json({ onDuty: false, message: 'تم إنهاء الدوام', todayMin: 0 });
    }

    if (settings.lockoutEnabled && time.isLockoutActive(now, settings.lockoutStart, settings.lockoutEnd)) {
      throw fail(403, site.strings.attendance.blocked, 'LOCKOUT');
    }

    const created = await DutySession.create({ user: req.user._id, start: now, open: true });
    req.user.lastSeenAt = now;
    await req.user.save();
    return res.json({ onDuty: true, since: created.start, message: 'تم بدء الدوام' });
  })
);

module.exports = router;
