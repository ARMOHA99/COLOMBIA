'use strict';

const router = require('express').Router();
const { Discipline, User } = require('../models');
const rolesSvc = require('../services/roles');
const bus = require('../services/bus');
const { logAudit } = require('../services/audit');
const { asyncHandler, fail } = require('../middleware/errors');
const { requireAuth, requireRank } = require('../middleware/auth');
const site = require('../../config/site');

router.use(requireAuth, requireRank('member'));

function serialize(d) {
  return {
    id: String(d._id),
    kind: d.kind,
    kindLabel: site.statuses.disciplineKinds[d.kind] || d.kind,
    text: d.text,
    amount: d.amount,
    balanceBefore: d.balanceBefore,
    balanceAfter: d.balanceAfter,
    user: d.user
      ? {
          id: String(d.user._id),
          name: d.user.displayName ? d.user.displayName() : String(d.user),
          avatar: d.user.avatarUrl ? d.user.avatarUrl(64) : '',
          rank: d.user.rank
        }
      : null,
    by: d.by && d.by.displayName ? d.by.displayName() : '',
    createdAt: d.createdAt
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const isStaff = rolesSvc.rankValue(req.user.rank) >= 3;
    const filter = isStaff ? {} : { user: req.user._id };
    if (isStaff && req.query.userId) filter.user = req.query.userId;
    const docs = await Discipline.find(filter)
      .sort({ createdAt: -1 })
      .limit(150)
      .populate('user', 'globalName username avatar rank')
      .populate('by', 'globalName username');
    res.json({ records: docs.map(serialize), scope: isStaff ? 'all' : 'mine' });
  })
);

router.post(
  '/',
  requireRank('ops'),
  asyncHandler(async (req, res) => {
    const { userId, kind, text, amount } = req.body || {};
    if (!userId || !['note', 'warning', 'fine'].includes(kind) || !text) {
      throw fail(400, site.strings.errors.validation, 'VALIDATION');
    }
    const target = await User.findById(userId);
    if (!target) throw fail(404, site.strings.errors.notFound, 'NOT_FOUND');

    const doc = { user: target._id, kind, text: String(text).slice(0, 1000), by: req.user._id };
    if (kind === 'fine') {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) throw fail(400, site.strings.errors.validation, 'VALIDATION');
      doc.amount = Math.round(value * 100) / 100;
      doc.balanceBefore = target.balance;
      target.balance = Math.round((target.balance - doc.amount) * 100) / 100;
      doc.balanceAfter = target.balance;
      await target.save();
      await logAudit({
        actor: req.user,
        action: 'discipline.fine',
        targetType: 'user',
        targetId: target.discordId,
        before: { balance: doc.balanceBefore },
        after: { balance: doc.balanceAfter, amount: doc.amount },
        ip: req.ip
      });
    }

    const record = await Discipline.create(doc);
    await logAudit({ actor: req.user, action: 'discipline.create', targetType: 'discipline', targetId: record._id, after: { kind, userId: target.discordId }, ip: req.ip });

    const fresh = await Discipline.findById(record._id)
      .populate('user', 'globalName username avatar rank')
      .populate('by', 'globalName username');

    bus.emit('notify', { room: `user:${target.discordId}`, event: 'discipline:new', data: serialize(fresh) });
    bus.emit('notify', { room: `user:${target.discordId}`, event: 'user:updated', data: rolesSvc.publicUser(target) });

    res.status(201).json({ record: serialize(fresh) });
  })
);

router.delete(
  '/:id',
  requireRank('ops'),
  asyncHandler(async (req, res) => {
    const record = await Discipline.findById(req.params.id);
    if (!record) throw fail(404, site.strings.errors.notFound, 'NOT_FOUND');
    const snapshot = { kind: record.kind, text: record.text, amount: record.amount };
    await record.deleteOne();
    await logAudit({ actor: req.user, action: 'discipline.delete', targetType: 'discipline', targetId: req.params.id, before: snapshot, ip: req.ip });
    res.json({ ok: true });
  })
);

module.exports = router;
