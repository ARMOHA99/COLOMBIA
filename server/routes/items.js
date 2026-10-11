'use strict';

const router = require('express').Router();
const { Item } = require('../models');
const { logAudit } = require('../services/audit');
const { asyncHandler, fail } = require('../middleware/errors');
const { requireAuth, requireRankOr } = require('../middleware/auth');
const site = require('../../config/site');

router.use(requireAuth, requireRankOr('ops', 'business'));

function canWrite(req) {
  return req.user.rank === 'business' || (req.userRankValue || 0) >= 4;
}

function requireWriter(req, res, next) {
  if (!canWrite(req)) {
    return res.status(403).json({ error: site.strings.errors.forbidden, code: 'FORBIDDEN' });
  }
  return next();
}

function serialize(i) {
  return {
    id: String(i._id),
    name: i.name,
    category: i.category,
    price: i.price,
    active: i.active,
    sortOrder: i.sortOrder
  };
}

function clean(body, { partial = false } = {}) {
  const out = {};
  const b = body || {};
  if (!partial || b.name !== undefined) {
    const name = String(b.name || '').trim().slice(0, 80);
    if (!name) throw fail(400, site.strings.errors.validation, 'VALIDATION');
    out.name = name;
  }
  if (!partial || b.category !== undefined) {
    out.category = String(b.category || '').trim().slice(0, 40) || 'أخرى';
  }
  if (!partial || b.price !== undefined) {
    const price = Number(b.price);
    if (!Number.isFinite(price) || price < 0 || price > 1000000000) {
      throw fail(400, site.strings.errors.validation, 'VALIDATION');
    }
    out.price = Math.round(price * 100) / 100;
  }
  if (b.active !== undefined) out.active = Boolean(b.active);
  if (b.sortOrder !== undefined) out.sortOrder = Math.floor(Number(b.sortOrder) || 0);
  return out;
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const writer = canWrite(req);
    const filter = writer ? {} : { active: true };
    const items = await Item.find(filter).sort({ category: 1, sortOrder: 1, name: 1 }).limit(500);
    res.json({ items: items.map(serialize), canWrite: writer });
  })
);

router.post(
  '/',
  requireWriter,
  asyncHandler(async (req, res) => {
    const data = clean(req.body);
    const item = await Item.create(data);
    await logAudit({ actor: req.user, action: 'item.create', targetType: 'item', targetId: item._id, after: { name: item.name, price: item.price }, ip: req.ip });
    res.status(201).json({ item: serialize(item) });
  })
);

router.put(
  '/:id',
  requireWriter,
  asyncHandler(async (req, res) => {
    const item = await Item.findById(req.params.id);
    if (!item) throw fail(404, site.strings.errors.notFound, 'NOT_FOUND');
    const before = { name: item.name, price: item.price, active: item.active };
    Object.assign(item, clean(req.body, { partial: true }));
    await item.save();
    await logAudit({ actor: req.user, action: 'item.update', targetType: 'item', targetId: item._id, before, after: { name: item.name, price: item.price, active: item.active }, ip: req.ip });
    res.json({ item: serialize(item) });
  })
);

router.delete(
  '/:id',
  requireWriter,
  asyncHandler(async (req, res) => {
    const item = await Item.findById(req.params.id);
    if (!item) throw fail(404, site.strings.errors.notFound, 'NOT_FOUND');
    const snapshot = { name: item.name, price: item.price };
    await item.deleteOne();
    await logAudit({ actor: req.user, action: 'item.delete', targetType: 'item', targetId: req.params.id, before: snapshot, ip: req.ip });
    res.json({ ok: true });
  })
);

module.exports = router;
