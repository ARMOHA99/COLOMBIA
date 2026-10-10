'use strict';

const router = require('express').Router();
const { User, Operation, Announcement, TreasuryEntry, DutySession, Ticket, Order, FarmPlot } = require('../models');
const targetSvc = require('../services/target');
const time = require('../utils/time');
const { asyncHandler } = require('../middleware/errors');
const { requireAuth, requireRank } = require('../middleware/auth');

router.use(requireAuth, requireRank('member'));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const bounds = time.weekBounds();
    const now = new Date();
    const todayStartZoned = time.toZoned(now);
    const todayZonedStart = new Date(
      Date.UTC(todayStartZoned.getUTCFullYear(), todayStartZoned.getUTCMonth(), todayStartZoned.getUTCDate())
    );
    const todayStart = time.fromZoned(todayZonedStart);

    const [memberCount, opsWeek, balanceAgg, announcements, target, latestOps, duty, openTickets, pendingOrders, plots] =
      await Promise.all([
        User.countDocuments({ rank: { $in: ['member', 'ops', 'admin'] }, banned: false }),
        Operation.countDocuments({ date: { $gte: bounds.start, $lt: bounds.end } }),
        TreasuryEntry.aggregate([
          {
            $group: {
              _id: '$type',
              total: { $sum: '$amount' }
            }
          }
        ]),
        Announcement.find().sort({ pinned: -1, createdAt: -1 }).limit(5),
        targetSvc.getCurrentTarget(),
        Operation.find().sort({ date: -1 }).limit(8).populate('participants', 'globalName username avatar rank'),
        DutySession.findOne({ user: req.user._id, open: true }),
        Ticket.countDocuments({ user: req.user._id, status: 'pending' }),
        Order.countDocuments({ status: { $in: ['new', 'preparing'] } }),
        FarmPlot.countDocuments({ status: 'ready' })
      ]);

    const income = balanceAgg.find((x) => x._id === 'income')?.total || 0;
    const expense = balanceAgg.find((x) => x._id === 'expense')?.total || 0;

    res.json({
      stats: {
        members: memberCount,
        opsWeek,
        balance: Math.round((income - expense) * 100) / 100,
        pendingOrders,
        openTickets,
        readyPlots: plots
      },
      announcements,
      target: targetSvc.serialize(target),
      latestOps,
      duty: { onDuty: Boolean(duty), since: duty ? duty.start : null },
      me: {
        todayStart
      }
    });
  })
);

router.get(
  '/announcements',
  asyncHandler(async (req, res) => {
    const announcements = await Announcement.find().sort({ pinned: -1, createdAt: -1 }).limit(20);
    res.json({ announcements });
  })
);

module.exports = router;
