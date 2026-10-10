'use strict';

const router = require('express').Router();
const { Operation, OperationType, User } = require('../models');
const targetSvc = require('../services/target');
const rolesSvc = require('../services/roles');
const bus = require('../services/bus');
const { logAudit } = require('../services/audit');
const { asyncHandler, fail } = require('../middleware/errors');
const { requireAuth, requireRank } = require('../middleware/auth');
const site = require('../../config/site');

router.use(requireAuth, requireRank('member'));

function serialize(op) {
  return {
    id: String(op._id),
    title: op.title,
    typeKey: op.typeKey,
    typeLabel: op.typeLabel,
    date: op.date,
    result: op.result,
    winAmount: op.winAmount || 0,
    lossAmount: op.lossAmount || 0,
    participants: (op.participants || []).filter(Boolean).map((u) => ({
      id: String(u._id),
      name: u.displayName ? u.displayName() : String(u),
      avatar: u.avatarUrl ? u.avatarUrl(64) : '',
      rank: u.rank || ''
    })),
    notes: op.notes,
    createdBy: op.createdBy && op.createdBy.displayName ? op.createdBy.displayName() : '',
    updatedAt: op.updatedAt
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [ops, types, target, history] = await Promise.all([
      Operation.find().sort({ date: -1 }).limit(100).populate('participants', 'globalName username avatar rank discordId'),
      OperationType.find({ active: true }).sort({ sortOrder: 1 }),
      targetSvc.getCurrentTarget(),
      targetSvc.history()
    ]);
    res.json({
      operations: ops.map(serialize),
      types: types.map((t) => ({ key: t.key, label: t.label, color: t.color })),
      target: targetSvc.serialize(target),
      history,
      canEdit: rolesSvc.rankValue(req.user.rank) >= 3
    });
  })
);

router.get(
  '/target',
  asyncHandler(async (req, res) => {
    const target = await targetSvc.getCurrentTarget();
    const history = await targetSvc.history();
    res.json({ target: targetSvc.serialize(target), history });
  })
);

router.post(
  '/',
  requireRank('ops'),
  asyncHandler(async (req, res) => {
    const { title, typeKey, date, result, participants, notes } = req.body || {};
    if (!title || !typeKey) throw fail(400, site.strings.errors.validation, 'VALIDATION');
    const type = await OperationType.findOne({ key: typeKey });
    if (!type) throw fail(400, site.strings.errors.validation, 'VALIDATION');

    const op = await Operation.create({
      title: String(title).slice(0, 120),
      typeKey: type.key,
      typeLabel: type.label,
      date: date ? new Date(date) : new Date(),
      result: ['win', 'loss', 'pending'].includes(result) ? result : 'pending',
      participants: Array.isArray(participants) ? participants.slice(0, 60) : [],
      notes: notes ? String(notes).slice(0, 1000) : '',
      createdBy: req.user._id,
      updatedBy: req.user._id
    });

    await targetSvc.recomputeTarget();
    await logAudit({ actor: req.user, action: 'operation.create', targetType: 'operation', targetId: op._id, after: { title: op.title, result: op.result }, ip: req.ip });
    const populated = await Operation.findById(op._id).populate('participants', 'globalName username avatar rank');
    bus.emit('notify', { room: 'scope:members', event: 'ops:new', data: serialize(populated) });
    res.status(201).json({ operation: serialize(populated) });
  })
);

router.put(
  '/:id',
  requireRank('ops'),
  asyncHandler(async (req, res) => {
    const op = await Operation.findById(req.params.id);
    if (!op) throw fail(404, site.strings.errors.notFound, 'NOT_FOUND');
    const before = { title: op.title, result: op.result, typeKey: op.typeKey, participants: op.participants.length };
    const { title, typeKey, date, result, participants, notes } = req.body || {};

    if (title) op.title = String(title).slice(0, 120);
    if (typeKey) {
      const type = await OperationType.findOne({ key: typeKey });
      if (!type) throw fail(400, site.strings.errors.validation, 'VALIDATION');
      op.typeKey = type.key;
      op.typeLabel = type.label;
    }
    if (date) op.date = new Date(date);
    if (result && ['win', 'loss', 'pending'].includes(result)) op.result = result;
    if (participants !== undefined) op.participants = Array.isArray(participants) ? participants.slice(0, 60) : [];
    if (notes !== undefined) op.notes = String(notes).slice(0, 1000);
    op.updatedBy = req.user._id;
    await op.save();

    await targetSvc.recomputeTarget();
    await logAudit({ actor: req.user, action: 'operation.update', targetType: 'operation', targetId: op._id, before, after: { title: op.title, result: op.result }, ip: req.ip });
    const populated = await Operation.findById(op._id).populate('participants', 'globalName username avatar rank');
    bus.emit('notify', { room: 'scope:members', event: 'ops:updated', data: serialize(populated) });
    res.json({ operation: serialize(populated) });
  })
);

router.delete(
  '/:id',
  requireRank('ops'),
  asyncHandler(async (req, res) => {
    const op = await Operation.findById(req.params.id);
    if (!op) throw fail(404, site.strings.errors.notFound, 'NOT_FOUND');
    const snapshot = { title: op.title, result: op.result, date: op.date };
    await op.deleteOne();
    await targetSvc.recomputeTarget();
    await logAudit({ actor: req.user, action: 'operation.delete', targetType: 'operation', targetId: req.params.id, before: snapshot, ip: req.ip });
    bus.emit('notify', { room: 'scope:members', event: 'ops:deleted', data: { id: req.params.id } });
    res.json({ ok: true });
  })
);

module.exports = router;
