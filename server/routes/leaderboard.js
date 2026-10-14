'use strict';

const router = require('express').Router();
const { User, Operation, DutySession, Discipline } = require('../models');
const { asyncHandler, fail } = require('../middleware/errors');
const { requireAuth, requirePerm } = require('../middleware/auth');
const site = require('../../config/site');
const hoursSvc = require('../services/hours');
const rolesSvc = require('../services/roles');
const memberCard = require('../services/memberCard');

router.use(requireAuth);

router.get(
  '/',
  requirePerm('view.leaderboard'),
  asyncHandler(async (req, res) => {
    const [opsPts, dutyPts, users, adjMap] = await Promise.all([
      Operation.aggregate([
        { $match: { result: { $in: ['win', 'loss'] } } },
        { $unwind: '$participants' },
        {
          $group: {
            _id: '$participants',
            wins: { $sum: { $cond: [{ $eq: ['$result', 'win'] }, 1, 0] } },
            losses: { $sum: { $cond: [{ $eq: ['$result', 'loss'] }, 1, 0] } },
            ops: { $sum: 1 }
          }
        }
      ]),
      DutySession.aggregate([{ $group: { _id: '$user', minutes: { $sum: '$durationMin' } } }]),
      User.find({ rank: { $in: ['member', 'ops', 'admin', 'business', 'custom'] }, banned: false })
        .select('globalName username avatar rank roleLabel discordId joinedAt'),
      hoursSvc.adjustmentsByUser()
    ]);

    const opsMap = new Map(opsPts.map((r) => [String(r._id), r]));
    const dutyMap = new Map(dutyPts.map((r) => [String(r._id), r]));

    const rows = users.map((u) => {
      const ops = opsMap.get(String(u._id)) || { wins: 0, losses: 0, ops: 0 };
      const duty = dutyMap.get(String(u._id)) || { minutes: 0 };
      const dutyMinutes = Math.max(0, duty.minutes - (adjMap.get(String(u._id)) || 0));
      const dutyHours = Math.round((dutyMinutes / 60) * 10) / 10;
      const opsPoints = ops.wins * 3 + ops.losses;
      const score = opsPoints + Math.floor(dutyHours);
      return {
        id: String(u._id),
        name: u.displayName(),
        avatar: u.avatarUrl(128),
        rank: u.rank,
        rankLabel: rolesSvc.rankLabelOf(u),
        wins: ops.wins,
        losses: ops.losses,
        opsCount: ops.ops,
        opsPoints,
        dutyHours,
        score,
        isMe: String(u._id) === String(req.user._id)
      };
    });

    rows.sort((a, b) => b.score - a.score || b.wins - a.wins);
    const top = rows.slice(0, 25).map((r, i) => ({ ...r, position: i + 1 }));
    const myIndex = rows.findIndex((r) => r.isMe);

    res.json({
      leaderboard: top,
      me: myIndex >= 0 ? { ...rows[myIndex], position: myIndex + 1 } : null,
      total: rows.length,
      scoring: { win: 3, loss: 1, hour: 1 }
    });
  })
);

router.get(
  '/card',
  requirePerm('view.card', 'members.view'),
  asyncHandler(async (req, res) => {
    res.json({ card: await memberCard.buildCard(req.user) });
  })
);

router.get(
  '/card/:id',
  requirePerm('members.view'),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw fail(404, site.strings.errors.notFound, 'NOT_FOUND');
    res.json({ card: await memberCard.buildCard(user) });
  })
);

module.exports = router;
