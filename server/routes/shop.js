'use strict';

const router = require('express').Router();
const { Order, Product } = require('../models');
const rolesSvc = require('../services/roles');
const bus = require('../services/bus');
const { asyncHandler, fail } = require('../middleware/errors');
const { requireAuth, requireRank } = require('../middleware/auth');
const site = require('../../config/site');

router.use(requireAuth, requireRank('shop'));
router.use((req, res, next) => {
  if (req.user && req.user.rank === 'member') {
    return res.status(403).json({ error: site.strings.errors.forbidden, code: 'FORBIDDEN' });
  }
  return next();
});

function requireShopDuty(req, res, next) {
  if (!rolesSvc.hasShopDuty(req.user)) {
    return res.status(403).json({ error: site.strings.errors.forbidden, code: 'FORBIDDEN' });
  }
  return next();
}

function serialize(o) {
  return {
    id: String(o._id),
    items: (o.items || []).map((i) => ({ name: i.name, price: i.price, qty: i.qty, total: i.price * i.qty })),
    ingameId: o.ingameId,
    note: o.note,
    total: o.total,
    status: o.status,
    statusLabel: site.statuses.order[o.status] || o.status,
    history: (o.history || []).map((h) => ({ status: h.status, label: site.statuses.order[h.status] || h.status, at: h.at })),
    user: o.user
      ? {
          id: String(o.user._id),
          name: o.user.displayName ? o.user.displayName() : String(o.user),
          avatar: o.user.avatarUrl ? o.user.avatarUrl(64) : '',
          rank: o.user.rank
        }
      : null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt
  };
}

router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const products = await Product.find({ active: true }).sort({ sortOrder: 1, createdAt: 1 });
    res.json({
      products: products.map((p) => ({
        id: String(p._id),
        name: p.name,
        description: p.description,
        category: p.category,
        price: p.price,
        stock: p.stock,
        imageUrl: p.imageUrl,
        soldCount: p.soldCount,
        out: p.stock <= 0
      }))
    });
  })
);

router.post(
  '/orders',
  asyncHandler(async (req, res) => {
    const { items, ingameId, note } = req.body || {};
    if (!Array.isArray(items) || !items.length || !ingameId) throw fail(400, site.strings.errors.validation, 'VALIDATION');
    if (String(ingameId).length > 32) throw fail(400, site.strings.errors.validation, 'VALIDATION');

    const ids = [...new Set(items.map((i) => String(i.productId)))];
    const products = await Product.find({ _id: { $in: ids }, active: true });
    const byId = new Map(products.map((p) => [String(p._id), p]));

    const orderItems = [];
    for (const raw of items) {
      const product = byId.get(String(raw.productId));
      const qty = Math.max(1, Math.min(50, parseInt(raw.qty, 10) || 1));
      if (!product) throw fail(404, site.strings.errors.notFound, 'PRODUCT');
      const updated = await Product.findOneAndUpdate(
        { _id: product._id, stock: { $gte: qty } },
        { $inc: { stock: -qty, soldCount: qty } },
        { new: true }
      );
      if (!updated) throw fail(409, `${product.name}: ${site.strings.shop.outOfStock}`, 'OUT_OF_STOCK');
      orderItems.push({ product: product._id, name: product.name, price: product.price, qty });
    }

    const total = orderItems.reduce((a, i) => a + i.price * i.qty, 0);
    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      ingameId: String(ingameId).slice(0, 32),
      note: note ? String(note).slice(0, 500) : '',
      total,
      status: 'new',
      history: [{ status: 'new', at: new Date(), by: req.user._id }]
    });

    const fresh = await Order.findById(order._id).populate('user', 'globalName username avatar rank');
    const payload = serialize(fresh);
    bus.emit('notify', { room: 'scope:shop', event: 'order:new', data: payload });
    bus.emit('notify', { room: `user:${req.user.discordId}`, event: 'order:new', data: payload });
    res.status(201).json({ order: payload, message: site.strings.shop.orderSent });
  })
);

router.get(
  '/orders/mine',
  asyncHandler(async (req, res) => {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50);
    res.json({ orders: orders.map(serialize) });
  })
);

router.get(
  '/orders',
  asyncHandler(async (req, res) => {
    const canSeeAll = rolesSvc.hasShopDuty(req.user);
    const filter = canSeeAll ? {} : { user: req.user._id };
    if (canSeeAll && req.query.status) filter.status = req.query.status;
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('user', 'globalName username avatar rank');
    res.json({ orders: orders.map(serialize), canManage: canSeeAll });
  })
);

router.put(
  '/orders/:id/status',
  requireShopDuty,
  asyncHandler(async (req, res) => {
    const { status } = req.body || {};
    if (!['new', 'preparing', 'delivered', 'cancelled'].includes(status)) {
      throw fail(400, site.strings.errors.validation, 'VALIDATION');
    }
    const order = await Order.findById(req.params.id);
    if (!order) throw fail(404, site.strings.errors.notFound, 'NOT_FOUND');
    if (order.status === status) return res.json({ order: serialize(order) });

    const before = order.status;
    if (status === 'cancelled' && order.status !== 'cancelled') {
      for (const item of order.items) {
        await Product.updateOne({ _id: item.product }, { $inc: { stock: item.qty, soldCount: -item.qty } });
      }
    }
    order.status = status;
    order.history.push({ status, at: new Date(), by: req.user._id });
    await order.save();

    const fresh = await Order.findById(order._id).populate('user', 'globalName username avatar rank');
    const payload = serialize(fresh);
    bus.emit('notify', { room: 'scope:shop', event: 'order:status', data: payload });
    if (fresh.user) {
      bus.emit('notify', { room: `user:${fresh.user.discordId}`, event: 'order:status', data: payload });
    }
    return res.json({ order: payload, before });
  })
);

router.delete(
  '/orders/:id',
  requireRank('ops'),
  asyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (!order) throw fail(404, site.strings.errors.notFound, 'NOT_FOUND');
    if (order.status !== 'cancelled' && order.status !== 'delivered') {
      for (const item of order.items) {
        await Product.updateOne({ _id: item.product }, { $inc: { stock: item.qty, soldCount: -item.qty } });
      }
    }
    const snapshot = { items: order.items.map((i) => ({ name: i.name, qty: i.qty })), status: order.status };
    await order.deleteOne();
    const { logAudit } = require('../services/audit');
    await logAudit({ actor: req.user, action: 'order.delete', targetType: 'order', targetId: order._id, before: snapshot, ip: req.ip });
    bus.emit('notify', { room: 'scope:shop', event: 'order:deleted', data: { id: req.params.id } });
    res.json({ ok: true });
  })
);

module.exports = router;
