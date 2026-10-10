'use strict';

const router = require('express').Router();
const { TreasuryEntry, Settings } = require('../models');
const bus = require('../services/bus');
const { logAudit } = require('../services/audit');
const { asyncHandler, fail } = require('../middleware/errors');
const { requireAuth, requireRank } = require('../middleware/auth');
const site = require('../../config/site');

router.use(requireAuth, requireRank('ops'));

function serialize(e) {
  return {
    id: String(e._id),
    type: e.type,
    category: e.category,
    amount: e.amount,
    note: e.note,
    by: e.by && e.by.displayName ? e.by.displayName() : '',
    entryDate: e.entryDate,
    createdAt: e.createdAt
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const [entries, agg, settings] = await Promise.all([
      TreasuryEntry.find().sort({ entryDate: -1 }).limit(100).populate('by', 'globalName username'),
      TreasuryEntry.aggregate([{ $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
      Settings.getInstance()
    ]);
    const income = agg.find((a) => a._id === 'income')?.total || 0;
    const expense = agg.find((a) => a._id === 'expense')?.total || 0;
    res.json({
      entries: entries.map(serialize),
      balance: Math.round((income - expense) * 100) / 100,
      summary: { income, expense, count: entries.length },
      categories: settings.treasuryCategories || [],
      canWrite: req.userRankValue >= 3
    });
  })
);

router.post(
  '/',
  requireRank('ops'),
  asyncHandler(async (req, res) => {
    const { type, category, amount, note } = req.body || {};
    if (!['income', 'expense'].includes(type)) throw fail(400, site.strings.errors.validation, 'VALIDATION');
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) throw fail(400, site.strings.errors.validation, 'VALIDATION');

    const entry = await TreasuryEntry.create({
      type,
      category: category ? String(category).slice(0, 60) : 'أخرى',
      amount: Math.round(value * 100) / 100,
      note: note ? String(note).slice(0, 500) : '',
      by: req.user._id
    });
    await logAudit({ actor: req.user, action: 'treasury.create', targetType: 'entry', targetId: entry._id, after: { type, amount: entry.amount, category: entry.category }, ip: req.ip });

    const fresh = await TreasuryEntry.findById(entry._id).populate('by', 'globalName username');
    bus.emit('notify', { room: 'scope:members', event: 'treasury:updated', data: serialize(fresh) });
    res.status(201).json({ entry: serialize(fresh) });
  })
);

router.put(
  '/:id',
  requireRank('ops'),
  asyncHandler(async (req, res) => {
    const entry = await TreasuryEntry.findById(req.params.id);
    if (!entry) throw fail(404, site.strings.errors.notFound, 'NOT_FOUND');
    const before = { type: entry.type, amount: entry.amount, category: entry.category, note: entry.note };
    const { type, category, amount, note } = req.body || {};
    if (type && ['income', 'expense'].includes(type)) entry.type = type;
    if (category !== undefined) entry.category = String(category).slice(0, 60);
    if (amount !== undefined) {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) throw fail(400, site.strings.errors.validation, 'VALIDATION');
      entry.amount = Math.round(value * 100) / 100;
    }
    if (note !== undefined) entry.note = String(note).slice(0, 500);
    await entry.save();
    await logAudit({ actor: req.user, action: 'treasury.update', targetType: 'entry', targetId: entry._id, before, after: { type: entry.type, amount: entry.amount }, ip: req.ip });
    const fresh = await TreasuryEntry.findById(entry._id).populate('by', 'globalName username');
    bus.emit('notify', { room: 'scope:members', event: 'treasury:updated', data: serialize(fresh) });
    res.json({ entry: serialize(fresh) });
  })
);

router.delete(
  '/:id',
  requireRank('ops'),
  asyncHandler(async (req, res) => {
    const entry = await TreasuryEntry.findById(req.params.id);
    if (!entry) throw fail(404, site.strings.errors.notFound, 'NOT_FOUND');
    const snapshot = { type: entry.type, amount: entry.amount, category: entry.category };
    await entry.deleteOne();
    await logAudit({ actor: req.user, action: 'treasury.delete', targetType: 'entry', targetId: req.params.id, before: snapshot, ip: req.ip });
    bus.emit('notify', { room: 'scope:members', event: 'treasury:updated', data: { id: req.params.id, deleted: true } });
    res.json({ ok: true });
  })
);

module.exports = router;
