'use strict';

const router = require('express').Router();
const { InternalItem, Order } = require('../models');
const bus = require('../services/bus');
const discordNotify = require('../services/discordNotify');
const { serialize } = require('../services/orderSerialize');
const { asyncHandler, fail } = require('../middleware/errors');
const { requireAuth, requireRank } = require('../middleware/auth');
const site = require('../../config/site');

router.use(requireAuth, requireRank('member'));

router.get(
  '/items',
  asyncHandler(async (req, res) => {
    const items = await InternalItem.find({ active: true }).sort({ sortOrder: 1, createdAt: 1 });
    res.json({
      items: items.map((i) => ({
        id: String(i._id),
        name: i.name,
        description: i.description,
        stock: i.stock,
        imageUrl: i.imageUrl,
        out: i.stock <= 0
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

    const ids = [...new Set(items.map((i) => String(i.itemId)))];
    const found = await InternalItem.find({ _id: { $in: ids }, active: true });
    const byId = new Map(found.map((p) => [String(p._id), p]));

    const taken = [];
    const orderItems = [];
    try {
      for (const raw of items) {
        const item = byId.get(String(raw.itemId));
        const qty = Math.max(1, Math.min(50, parseInt(raw.qty, 10) || 1));
        if (!item) throw fail(404, site.strings.errors.notFound, 'ITEM');
        const updated = await InternalItem.findOneAndUpdate({ _id: item._id, stock: { $gte: qty } }, { $inc: { stock: -qty } }, { new: true });
        if (!updated) throw fail(409, `${item.name}: ${site.strings.shop.outOfStock}`, 'OUT_OF_STOCK');
        taken.push({ id: item._id, qty });
        orderItems.push({ internalItem: item._id, name: item.name, price: 0, qty });
      }
    } catch (err) {
      for (const t of taken) await InternalItem.updateOne({ _id: t.id }, { $inc: { stock: t.qty } });
      throw err;
    }

    const order = await Order.create({
      user: req.user._id,
      kind: 'internal',
      items: orderItems,
      ingameId: String(ingameId).slice(0, 32),
      note: note ? String(note).slice(0, 500) : '',
      total: 0,
      status: 'new',
      history: [{ status: 'new', at: new Date(), by: req.user._id }]
    });

    const fresh = await Order.findById(order._id).populate('user', 'globalName username avatar rank');
    const payload = serialize(fresh);
    bus.emit('notify', { room: 'scope:shop', event: 'order:new', data: payload });
    bus.emit('notify', { room: `user:${req.user.discordId}`, event: 'order:new', data: payload });
    discordNotify.notifyNewOrder(fresh, req.user, { internal: true }).catch(() => {});
    res.status(201).json({ order: payload, message: site.strings.internalShop.orderSent });
  })
);

router.get(
  '/orders/mine',
  asyncHandler(async (req, res) => {
    const orders = await Order.find({ user: req.user._id, kind: 'internal' }).sort({ createdAt: -1 }).limit(50);
    res.json({ orders: orders.map(serialize) });
  })
);

module.exports = router;
