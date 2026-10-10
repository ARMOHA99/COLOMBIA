'use strict';

const router = require('express').Router();
const { InternalItem, InternalPurchase, User } = require('../models');
const rolesSvc = require('../services/roles');
const bus = require('../services/bus');
const { logAudit } = require('../services/audit');
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
        price: i.price,
        stock: i.stock,
        imageUrl: i.imageUrl,
        out: i.stock <= 0
      })),
      balance: req.user.balance
    });
  })
);

router.post(
  '/purchase',
  asyncHandler(async (req, res) => {
    const { itemId, qty } = req.body || {};
    const quantity = Math.max(1, Math.min(10, parseInt(qty, 10) || 1));
    if (!itemId) throw fail(400, site.strings.errors.validation, 'VALIDATION');

    const item = await InternalItem.findOneAndUpdate(
      { _id: itemId, active: true, stock: { $gte: quantity } },
      { $inc: { stock: -quantity } },
      { new: true }
    );
    if (!item) throw fail(409, site.strings.errors.validation, 'OUT_OF_STOCK');

    const total = Math.round(item.price * quantity * 100) / 100;
    const updatedUser = await User.findOneAndUpdate(
      { _id: req.user._id, balance: { $gte: total } },
      { $inc: { balance: -total } },
      { new: true }
    );

    if (!updatedUser) {
      await InternalItem.updateOne({ _id: item._id }, { $inc: { stock: quantity } });
      throw fail(400, site.strings.internalShop.insufficient, 'INSUFFICIENT');
    }

    const purchase = await InternalPurchase.create({
      user: updatedUser._id,
      item: item._id,
      itemName: item.name,
      qty: quantity,
      unitPrice: item.price,
      total,
      balanceAfter: updatedUser.balance
    });

    await logAudit({
      actor: req.user,
      action: 'internal.buy',
      targetType: 'item',
      targetId: item._id,
      before: { balance: updatedUser.balance + total },
      after: { balance: updatedUser.balance, item: item.name, qty: quantity },
      ip: req.ip
    });

    bus.emit('notify', { room: `user:${updatedUser.discordId}`, event: 'user:updated', data: rolesSvc.publicUser(updatedUser) });
    bus.emit('notify', { room: 'scope:admin', event: 'internal:sold', data: { item: item.name, qty: quantity, total } });

    res.status(201).json({
      purchase: {
        id: String(purchase._id),
        itemName: purchase.itemName,
        qty: purchase.qty,
        total: purchase.total,
        balanceAfter: purchase.balanceAfter,
        createdAt: purchase.createdAt
      },
      balance: updatedUser.balance,
      message: site.strings.internalShop.purchased
    });
  })
);

router.get(
  '/purchases/mine',
  asyncHandler(async (req, res) => {
    const purchases = await InternalPurchase.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50);
    res.json({
      purchases: purchases.map((p) => ({
        id: String(p._id),
        itemName: p.itemName,
        qty: p.qty,
        unitPrice: p.unitPrice,
        total: p.total,
        balanceAfter: p.balanceAfter,
        createdAt: p.createdAt
      })),
      balance: req.user.balance
    });
  })
);

module.exports = router;
