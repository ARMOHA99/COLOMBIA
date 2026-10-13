'use strict';

const router = require('express').Router();
const { DutySession, Settings, User } = require('../models');
const time = require('../utils/time');
const hoursSvc = require('../services/hours');
const rolesSvc = require('../services/roles');
const duty = require('../services/duty');
const memberCard = require('../services/memberCard');
const { asyncHandler, fail } = require('../middleware/errors');
const { requireAuth, requirePerm } = require('../middleware/auth');
const site = require('../../config/site');

router.use(requireAuth, requirePerm('view.attendance', 'members.view'));

function liveMinutes(session) {
  return duty.netMinutes(session);
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const settings = await Settings.getInstance();
    const now = new Date();
    const z = time.toZoned(now);
    const todayStart = time.fromZoned(new Date(Date.UTC(z.getUTCFullYear(), z.getUTCMonth(), z.getUTCDate())));
    const week = time.weekBounds();

    const [open, todaySessions, weekSessions, recent, rosterDocs, weekAdjMin] = await Promise.all([
      DutySession.findOne({ user: req.user._id, open: true }),
      DutySession.find({ user: req.user._id, start: { $gte: todayStart } }),
      DutySession.find({ user: req.user._id, start: { $gte: week.start, $lt: week.end } }),
      DutySession.find({ user: req.user._id }).sort({ start: -1 }).limit(20),
      DutySession.find({ open: true }).populate('user', 'globalName username avatar rank roleLabel discordId').limit(50),
      hoursSvc.weekAdjustmentMin(req.user._id)
    ]);

    const sum = (list) => list.reduce((a, s) => a + liveMinutes(s), 0);

    res.json({
      onDuty: Boolean(open),
      since: open ? open.start : null,
      liveMin: open ? liveMinutes(open) : 0,
      onBreak: Boolean(open && duty.openBreak(open)),
      breakSince: open && duty.openBreak(open) ? duty.openBreak(open).start : null,
      breakMin: open ? duty.breakMinutes(open) : 0,
      todayMin: sum(todaySessions),
      weekMin: Math.max(0, sum(weekSessions) - weekAdjMin),
      weekPenaltyMin: weekAdjMin,
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
              rank: s.user.rank,
              rankLabel: rolesSvc.rankLabelOf(s.user)
            }
          : null,
        since: s.start,
        liveMin: liveMinutes(s),
        onBreak: Boolean(duty.openBreak(s))
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
      duty.closeOpenBreak(open, now);
      open.end = now;
      open.durationMin = duty.netMinutes(open);
      open.open = false;
      await open.save();
      return res.json({ onDuty: false, message: 'تم تسجيل الخروج', todayMin: 0 });
    }

    if (settings.lockoutEnabled && time.isLockoutActive(now, settings.lockoutStart, settings.lockoutEnd)) {
      throw fail(403, site.strings.attendance.blocked, 'LOCKOUT');
    }

    const created = await DutySession.create({ user: req.user._id, start: now, open: true });
    req.user.lastSeenAt = now;
    await req.user.save();
    return res.json({ onDuty: true, since: created.start, message: 'تم تسجيل الدخول' });
  })
);

router.post(
  '/break',
  asyncHandler(async (req, res) => {
    const open = await DutySession.findOne({ user: req.user._id, open: true });
    if (!open) throw fail(400, 'يجب تسجيل الدخول أولاً قبل أخذ استراحة', 'NOT_ON_DUTY');
    const current = duty.openBreak(open);
    const now = new Date();
    if (current) {
      current.end = now;
      await open.save();
      return res.json({ onBreak: false, message: 'تمت العودة من الاستراحة' });
    }
    open.breaks.push({ start: now, end: null });
    await open.save();
    return res.json({ onBreak: true, since: now, message: 'تم بدء الاستراحة، لن تُحتسب ساعاتك حتى تعود' });
  })
);

router.get(
  '/member/:id',
  requirePerm('members.view'),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw fail(404, site.strings.errors.notFound, 'NOT_FOUND');
    const period = ['week', 'lastweek', 'month', 'all'].includes(req.query.period) ? req.query.period : 'week';
    const log = await memberCard.attendanceLog(user, period);
    res.json({ user: { id: String(user._id), name: user.displayName() }, ...log });
  })
);

module.exports = router;
