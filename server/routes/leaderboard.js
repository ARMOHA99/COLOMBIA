'use strict';

const router = require('express').Router();
const { User, Operation, DutySession, Discipline, InternalPurchase } = require('../models');
const { asyncHandler } = require('../middleware/errors');
const { requireAuth, requireRank } = require('../middleware/auth');
const site = require('../../config/site');

router.use(requireAuth, requireRank('member'));

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [opsPts, dutyPts, users] = await Promise.all([
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
      User.find({ rank: { $in: ['member', 'ops', 'admin'] }, banned: false })
        .select('globalName username avatar rank discordId balance joinedAt')
    ]);

    const opsMap = new Map(opsPts.map((r) => [String(r._id), r]));
    const dutyMap = new Map(dutyPts.map((r) => [String(r._id), r]));

    const rows = users.map((u) => {
      const ops = opsMap.get(String(u._id)) || { wins: 0, losses: 0, ops: 0 };
      const duty = dutyMap.get(String(u._id)) || { minutes: 0 };
      const dutyHours = Math.round((duty.minutes / 60) * 10) / 10;
      const opsPoints = ops.wins * 3 + ops.losses;
      const score = opsPoints + Math.floor(dutyHours);
      return {
        id: String(u._id),
        name: u.displayName(),
        avatar: u.avatarUrl(128),
        rank: u.rank,
        rankLabel: site.ranks[u.rank] ? site.ranks[u.rank].label : u.rank,
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
  asyncHandler(async (req, res) => {
    const user = req.user;
    const since = user.joinedAt || user.createdAt;
    const [opsCount, wins, losses, missedOps, warnings, dutyAgg, gearAgg] = await Promise.all([
      Operation.countDocuments({ participants: user._id }),
      Operation.countDocuments({ participants: user._id, result: 'win' }),
      Operation.countDocuments({ participants: user._id, result: 'loss' }),
      Operation.countDocuments({ date: { $gte: since }, participants: { $ne: user._id } }),
      Discipline.countDocuments({ user: user._id, kind: { $in: ['warning', 'fine'] } }),
      DutySession.aggregate([
        { $match: { user: user._id } },
        { $group: { _id: null, minutes: { $sum: '$durationMin' } } }
      ]),
      InternalPurchase.aggregate([
        { $match: { user: user._id } },
        { $group: { _id: '$itemName', qty: { $sum: '$qty' } } },
        { $sort: { qty: -1 } },
        { $limit: 12 }
      ])
    ]);
    const minutes = dutyAgg[0] ? dutyAgg[0].minutes : 0;
    const totalOps = opsCount + missedOps;
    res.json({
      card: {
        id: String(user._id),
        name: user.displayName(),
        avatar: user.avatarUrl(256),
        discordId: user.discordId,
        rank: user.rank,
        rankLabel: site.ranks[user.rank] ? site.ranks[user.rank].label : user.rank,
        inGameId: user.inGameId || '—',
        joinedAt: user.joinedAt,
        balance: user.balance,
        opsCount,
        wins,
        losses,
        missedOps,
        warnings,
        participationRate: totalOps ? Math.round((opsCount / totalOps) * 100) : 0,
        dutyHours: Math.round((minutes / 60) * 10) / 10,
        gear: gearAgg.map((g) => ({ name: g._id, qty: g.qty }))
      }
    });
  })
);

module.exports = router;
