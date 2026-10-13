'use strict';

const router = require('express').Router();
const { Discipline, User } = require('../models');
const rolesSvc = require('../services/roles');
const bus = require('../services/bus');
const { logAudit } = require('../services/audit');
const discordNotify = require('../services/discordNotify');
const { asyncHandler, fail } = require('../middleware/errors');
const { requireAuth, requirePerm } = require('../middleware/auth');
const site = require('../../config/site');

router.use(requireAuth, requirePerm('view.discipline', 'discipline.write'));

function serialize(d) {
  return {
    id: String(d._id),
    kind: d.kind,
    kindLabel: site.statuses.disciplineKinds[d.kind] || d.kind,
    text: d.text,
    amount: d.amount,
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
    const isStaff = req.perms.has('discipline.write');
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
  requirePerm('discipline.write'),
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
    }

    const record = await Discipline.create(doc);
    await logAudit({ actor: req.user, action: 'discipline.create', targetType: 'discipline', targetId: record._id, after: { kind, userId: target.discordId }, ip: req.ip });

    const fresh = await Discipline.findById(record._id)
      .populate('user', 'globalName username avatar rank')
      .populate('by', 'globalName username');

    bus.emit('notify', { room: `user:${target.discordId}`, event: 'discipline:new', data: serialize(fresh) });
    bus.emit('notify', { room: `user:${target.discordId}`, event: 'user:updated', data: rolesSvc.publicUser(target) });
    discordNotify.notifyDiscipline(record, target, req.user).catch(() => {});

    res.status(201).json({ record: serialize(fresh) });
  })
);

router.delete(
  '/:id',
  requirePerm('discipline.write'),
  asyncHandler(async (req, res) => {
    const record = await Discipline.findById(req.params.id);
    if (!record) throw fail(404, site.strings.errors.notFound, 'NOT_FOUND');
    const snapshot = { kind: record.kind, text: record.text, amount: record.amount };
    const targetUser = await User.findById(record.user);
    await record.deleteOne();
    if (targetUser) discordNotify.clearDisciplineRole(targetUser, record.kind).catch(() => {});
    await logAudit({ actor: req.user, action: 'discipline.delete', targetType: 'discipline', targetId: req.params.id, before: snapshot, ip: req.ip });
    res.json({ ok: true });
  })
);

module.exports = router;
