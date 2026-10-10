'use strict';

const router = require('express').Router();
const {
  User,
  Product,
  Order,
  Operation,
  Announcement,
  InternalItem,
  InternalPurchase,
  Ticket,
  TreasuryEntry,
  AuditLog,
  Settings,
  DutySession
} = require('../models');
const env = require('../../config/env');
const site = require('../../config/site');
const rolesSvc = require('../services/roles');
const targetSvc = require('../services/target');
const farmSvc = require('../services/farm');
const discord = require('../services/discord');
const bus = require('../services/bus');
const { logAudit } = require('../services/audit');
const { asyncHandler, fail } = require('../middleware/errors');
const { requireAuth, requireRank } = require('../middleware/auth');
const { upload, uploadBuffer } = require('../middleware/upload');
const time = require('../utils/time');

router.use(requireAuth, requireRank('admin'));

const ROLE_BY_RANK = {
  admin: env.roles.admin,
  ops: env.roles.ops,
  member: env.roles.member,
  shop: env.roles.shop,
  guest: ''
};

function slimUser(u) {
  return {
    id: String(u._id),
    discordId: u.discordId,
    name: u.displayName(),
    avatar: u.avatarUrl(64),
    rank: u.rank,
    rankLabel: site.ranks[u.rank] ? site.ranks[u.rank].label : u.rank,
    balance: u.balance,
    banned: u.banned,
    banReason: u.banReason,
    inGameId: u.inGameId,
    joinedAt: u.joinedAt,
    lastSeenAt: u.lastSeenAt
  };
}

router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const week = time.weekBounds();
    const [users, products, orders, pendingTickets, opsWeek, dutyToday] = await Promise.all([
      User.countDocuments(),
      Product.countDocuments(),
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Ticket.countDocuments({ status: 'pending' }),
      Operation.countDocuments({ date: { $gte: week.start, $lt: week.end } }),
      DutySession.aggregate([
        { $match: { open: true } },
        { $count: 'count' }
      ])
    ]);
    const treasury = await TreasuryEntry.aggregate([{ $group: { _id: '$type', total: { $sum: '$amount' } } }]);
    const income = treasury.find((t) => t._id === 'income')?.total || 0;
    const expense = treasury.find((t) => t._id === 'expense')?.total || 0;
    res.json({
      stats: {
        users,
        products,
        orders: orders.reduce((a, o) => ({ ...a, [o._id]: o.count }), {}),
        ordersTotal: orders.reduce((a, o) => a + o.count, 0),
        pendingTickets,
        opsWeek,
        onDuty: dutyToday[0] ? dutyToday[0].count : 0,
        balance: Math.round((income - expense) * 100) / 100
      }
    });
  })
);

router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const products = await Product.find().sort({ sortOrder: 1, createdAt: -1 });
    res.json({
      products: products.map((p) => ({
        id: String(p._id),
        name: p.name,
        description: p.description,
        category: p.category,
        price: p.price,
        stock: p.stock,
        imageUrl: p.imageUrl,
        active: p.active,
        soldCount: p.soldCount,
        farmProduced: p.farmProduced,
        sortOrder: p.sortOrder
      })),
      categories: (await Settings.getInstance()).categories || []
    });
  })
);

router.post(
  '/products',
  asyncHandler(async (req, res) => {
    const { name, description, category, price, stock, imageUrl, active, sortOrder } = req.body || {};
    if (!name || price === undefined || Number(price) < 0) throw fail(400, site.strings.errors.validation, 'VALIDATION');
    const product = await Product.create({
      name: String(name).slice(0, 120),
      description: description ? String(description).slice(0, 1000) : '',
      category: category || 'أخرى',
      price: Number(price),
      stock: Math.max(0, parseInt(stock, 10) || 0),
      imageUrl: imageUrl || '',
      active: active !== false,
      sortOrder: parseInt(sortOrder, 10) || 0
    });
    await logAudit({ actor: req.user, action: 'product.create', targetType: 'product', targetId: product._id, after: { name: product.name, price: product.price }, ip: req.ip });
    bus.emit('notify', { room: 'scope:members', event: 'shop:changed', data: { id: String(product._id) } });
    res.status(201).json({ product });
  })
);

router.put(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw fail(404, site.strings.errors.notFound, 'NOT_FOUND');
    const before = { name: product.name, price: product.price, stock: product.stock, active: product.active };
    const { name, description, category, price, stock, imageUrl, active, sortOrder } = req.body || {};
    if (name !== undefined) product.name = String(name).slice(0, 120);
    if (description !== undefined) product.description = String(description).slice(0, 1000);
    if (category !== undefined) product.category = String(category).slice(0, 60);
    if (price !== undefined) product.price = Math.max(0, Number(price) || 0);
    if (stock !== undefined) product.stock = Math.max(0, parseInt(stock, 10) || 0);
    if (imageUrl !== undefined) product.imageUrl = imageUrl;
    if (active !== undefined) product.active = Boolean(active);
    if (sortOrder !== undefined) product.sortOrder = parseInt(sortOrder, 10) || 0;
    await product.save();
    await logAudit({ actor: req.user, action: 'product.update', targetType: 'product', targetId: product._id, before, after: { name: product.name, price: product.price, stock: product.stock }, ip: req.ip });
    bus.emit('notify', { room: 'scope:members', event: 'shop:changed', data: { id: String(product._id) } });
    res.json({ product });
  })
);

router.delete(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) throw fail(404, site.strings.errors.notFound, 'NOT_FOUND');
    const snapshot = { name: product.name, price: product.price, stock: product.stock };
    await product.deleteOne();
    await logAudit({ actor: req.user, action: 'product.delete', targetType: 'product', targetId: req.params.id, before: snapshot, ip: req.ip });
    bus.emit('notify', { room: 'scope:members', event: 'shop:changed', data: { id: req.params.id, deleted: true } });
    res.json({ ok: true });
  })
);

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const q = (req.query.q || '').trim();
    const filter = {};
    if (q) {
      filter.$or = [
        { globalName: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
        { username: { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
        { discordId: q },
        { inGameId: q }
      ];
    }
    const users = await User.find(filter).sort({ rank: -1, createdAt: -1 }).limit(200);
    res.json({ users: users.map(slimUser), total: await User.countDocuments() });
  })
);

router.put(
  '/users/:id/balance',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw fail(404, site.strings.errors.notFound, 'NOT_FOUND');
    const delta = Number((req.body || {}).delta);
    const reason = String((req.body || {}).reason || '').slice(0, 300);
    if (!Number.isFinite(delta) || delta === 0) throw fail(400, site.strings.errors.validation, 'VALIDATION');
    const before = user.balance;
    user.balance = Math.round((user.balance + delta) * 100) / 100;
    await user.save();
    await logAudit({ actor: req.user, action: 'user.balance', targetType: 'user', targetId: user.discordId, before: { balance: before }, after: { balance: user.balance, reason }, ip: req.ip });
    bus.emit('notify', { room: `user:${user.discordId}`, event: 'user:updated', data: rolesSvc.publicUser(user) });
    res.json({ user: slimUser(user) });
  })
);

router.put(
  '/users/:id/rank',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw fail(404, site.strings.errors.notFound, 'NOT_FOUND');
    const nextRank = (req.body || {}).rank;
    if (!['admin', 'ops', 'member', 'shop', 'guest'].includes(nextRank)) {
      throw fail(400, site.strings.errors.validation, 'VALIDATION');
    }

    const oldRank = user.rank;
    const targetRole = ROLE_BY_RANK[nextRank];

    if (env.discord.configured) {
      for (const [rankKey, roleId] of Object.entries(ROLE_BY_RANK)) {
        if (!roleId) continue;
        if (rankKey === nextRank && targetRole) {
          await discord.addRole(user.discordId, roleId);
        } else {
          await discord.removeRole(user.discordId, roleId);
        }
      }
    }

    user.roles = targetRole ? [targetRole] : [];
    user.rank = nextRank;
    user.rolesCheckedAt = new Date();
    await user.save();

    await logAudit({
      actor: req.user,
      action: 'user.rank',
      targetType: 'user',
      targetId: user.discordId,
      before: { rank: oldRank },
      after: { rank: nextRank },
      ip: req.ip
    });

    bus.emit('notify', { room: `user:${user.discordId}`, event: 'user:updated', data: rolesSvc.publicUser(user) });

    if (rolesSvc.rankValue(nextRank) < rolesSvc.rankValue(oldRank)) {
      await rolesSvc.registry.revoke(user.discordId);
      bus.emit('notify', {
        room: `user:${user.discordId}`,
        event: 'session:revoked',
        data: { reason: nextRank === 'guest' ? site.strings.auth.kicked : 'تم تعديل رتبتك، يرجى تسجيل الدخول مجدداً.' }
      });
    }

    res.json({ user: slimUser(user), message: site.strings.admin.rankChanged });
  })
);

router.put(
  '/users/:id/ban',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw fail(404, site.strings.errors.notFound, 'NOT_FOUND');
    const banned = Boolean((req.body || {}).banned);
    const reason = String((req.body || {}).reason || '').slice(0, 300);
    const before = { banned: user.banned, banReason: user.banReason };
    user.banned = banned;
    user.banReason = banned ? reason : '';
    await user.save();
    await logAudit({ actor: req.user, action: banned ? 'user.ban' : 'user.unban', targetType: 'user', targetId: user.discordId, before, after: { banned, reason }, ip: req.ip });
    if (banned) {
      await rolesSvc.registry.revoke(user.discordId);
      bus.emit('notify', { room: `user:${user.discordId}`, event: 'session:revoked', data: { reason: user.banReason || site.strings.errors.forbidden } });
    }
    res.json({ user: slimUser(user) });
  })
);

router.get(
  '/internal-items',
  asyncHandler(async (req, res) => {
    const items = await InternalItem.find().sort({ sortOrder: 1, createdAt: -1 });
    res.json({
      items: items.map((i) => ({
        id: String(i._id),
        name: i.name,
        description: i.description,
        price: i.price,
        stock: i.stock,
        imageUrl: i.imageUrl,
        active: i.active,
        sortOrder: i.sortOrder
      }))
    });
  })
);

router.post(
  '/internal-items',
  asyncHandler(async (req, res) => {
    const { name, description, price, stock, imageUrl, active, sortOrder } = req.body || {};
    if (!name || price === undefined) throw fail(400, site.strings.errors.validation, 'VALIDATION');
    const item = await InternalItem.create({
      name: String(name).slice(0, 120),
      description: description ? String(description).slice(0, 1000) : '',
      price: Math.max(0, Number(price) || 0),
      stock: Math.max(0, parseInt(stock, 10) || 0),
      imageUrl: imageUrl || '',
      active: active !== false,
      sortOrder: parseInt(sortOrder, 10) || 0
    });
    await logAudit({ actor: req.user, action: 'internalItem.create', targetType: 'internalItem', targetId: item._id, after: { name: item.name, price: item.price }, ip: req.ip });
    res.status(201).json({ item });
  })
);

router.put(
  '/internal-items/:id',
  asyncHandler(async (req, res) => {
    const item = await InternalItem.findById(req.params.id);
    if (!item) throw fail(404, site.strings.errors.notFound, 'NOT_FOUND');
    const before = { name: item.name, price: item.price, stock: item.stock, active: item.active };
    const { name, description, price, stock, imageUrl, active, sortOrder } = req.body || {};
    if (name !== undefined) item.name = String(name).slice(0, 120);
    if (description !== undefined) item.description = String(description).slice(0, 1000);
    if (price !== undefined) item.price = Math.max(0, Number(price) || 0);
    if (stock !== undefined) item.stock = Math.max(0, parseInt(stock, 10) || 0);
    if (imageUrl !== undefined) item.imageUrl = imageUrl;
    if (active !== undefined) item.active = Boolean(active);
    if (sortOrder !== undefined) item.sortOrder = parseInt(sortOrder, 10) || 0;
    await item.save();
    await logAudit({ actor: req.user, action: 'internalItem.update', targetType: 'internalItem', targetId: item._id, before, after: { price: item.price, stock: item.stock }, ip: req.ip });
    res.json({ item });
  })
);

router.delete(
  '/internal-items/:id',
  asyncHandler(async (req, res) => {
    const item = await InternalItem.findById(req.params.id);
    if (!item) throw fail(404, site.strings.errors.notFound, 'NOT_FOUND');
    const snapshot = { name: item.name, price: item.price };
    await item.deleteOne();
    await logAudit({ actor: req.user, action: 'internalItem.delete', targetType: 'internalItem', targetId: req.params.id, before: snapshot, ip: req.ip });
    res.json({ ok: true });
  })
);

router.get(
  '/announcements',
  asyncHandler(async (req, res) => {
    const announcements = await Announcement.find().sort({ createdAt: -1 }).limit(100);
    res.json({ announcements });
  })
);

router.post(
  '/announcements',
  asyncHandler(async (req, res) => {
    const { title, body, pinned } = req.body || {};
    if (!title || !body) throw fail(400, site.strings.errors.validation, 'VALIDATION');
    const doc = await Announcement.create({
      title: String(title).slice(0, 150),
      body: String(body).slice(0, 4000),
      pinned: Boolean(pinned),
      createdBy: req.user._id
    });
    await logAudit({ actor: req.user, action: 'announcement.create', targetType: 'announcement', targetId: doc._id, after: { title: doc.title }, ip: req.ip });
    bus.emit('notify', { room: 'scope:members', event: 'announcement:new', data: doc });
    res.status(201).json({ announcement: doc });
  })
);

router.put(
  '/announcements/:id',
  asyncHandler(async (req, res) => {
    const doc = await Announcement.findById(req.params.id);
    if (!doc) throw fail(404, site.strings.errors.notFound, 'NOT_FOUND');
    const before = { title: doc.title, pinned: doc.pinned };
    const { title, body, pinned } = req.body || {};
    if (title !== undefined) doc.title = String(title).slice(0, 150);
    if (body !== undefined) doc.body = String(body).slice(0, 4000);
    if (pinned !== undefined) doc.pinned = Boolean(pinned);
    await doc.save();
    await logAudit({ actor: req.user, action: 'announcement.update', targetType: 'announcement', targetId: doc._id, before, after: { title: doc.title }, ip: req.ip });
    bus.emit('notify', { room: 'scope:members', event: 'announcement:updated', data: doc });
    res.json({ announcement: doc });
  })
);

router.delete(
  '/announcements/:id',
  asyncHandler(async (req, res) => {
    const doc = await Announcement.findById(req.params.id);
    if (!doc) throw fail(404, site.strings.errors.notFound, 'NOT_FOUND');
    const snapshot = { title: doc.title };
    await doc.deleteOne();
    await logAudit({ actor: req.user, action: 'announcement.delete', targetType: 'announcement', targetId: req.params.id, before: snapshot, ip: req.ip });
    bus.emit('notify', { room: 'scope:members', event: 'announcement:deleted', data: { id: req.params.id } });
    res.json({ ok: true });
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

router.put(
  '/target',
  asyncHandler(async (req, res) => {
    const goal = Number((req.body || {}).goal);
    if (!Number.isFinite(goal) || goal < 0) throw fail(400, site.strings.errors.validation, 'VALIDATION');
    const before = (await Settings.getInstance()).weeklyGoal;
    const target = await targetSvc.setWeeklyGoal(goal);
    await logAudit({ actor: req.user, action: 'target.goal', targetType: 'weeklyTarget', targetId: target.weekKey, before: { goal: before }, after: { goal }, ip: req.ip });
    res.json({ target });
  })
);

router.get(
  '/audit',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit, 10) || 50));
    const filter = {};
    if (req.query.action) filter.action = String(req.query.action);
    if (req.query.targetId) filter.targetId = String(req.query.targetId);
    const [rows, total] = await Promise.all([
      AuditLog.find(filter).sort({ at: -1 }).skip((page - 1) * limit).limit(limit),
      AuditLog.countDocuments(filter)
    ]);
    res.json({
      rows: rows.map((r) => ({
        id: String(r._id),
        action: r.action,
        actorName: r.actor ? r.actor.name : '',
        targetType: r.targetType,
        targetId: r.targetId,
        before: r.before,
        after: r.after,
        ip: r.ip,
        at: r.at
      })),
      total,
      page,
      pages: Math.ceil(total / limit)
    });
  })
);

router.get(
  '/settings',
  asyncHandler(async (req, res) => {
    const settings = await Settings.getInstance();
    res.json({ settings });
  })
);

router.put(
  '/settings',
  asyncHandler(async (req, res) => {
    const settings = await Settings.getInstance();
    const allowed = [
      'siteName',
      'siteTagline',
      'logoUrl',
      'motd',
      'weeklyGoal',
      'lockoutEnabled',
      'lockoutStart',
      'lockoutEnd',
      'plotsCount',
      'categories',
      'treasuryCategories',
      'crops',
      'shopNotice',
      'maintenance'
    ];
    const before = {};
    const body = req.body || {};
    for (const key of allowed) {
      if (body[key] === undefined) continue;
      before[key] = settings[key];
      if (['weeklyGoal', 'plotsCount'].includes(key)) settings[key] = Math.max(0, parseInt(body[key], 10) || 0);
      else if (['lockoutEnabled', 'maintenance'].includes(key)) settings[key] = Boolean(body[key]);
      else if (['categories', 'treasuryCategories'].includes(key)) {
        settings[key] = Array.isArray(body[key]) ? body[key].map((c) => String(c).slice(0, 60)).slice(0, 40) : settings[key];
      } else if (key === 'crops') {
        settings[key] = Array.isArray(body[key]) ? body[key].slice(0, 24) : settings[key];
      } else settings[key] = String(body[key]).slice(0, 500);
    }
    if (settings.lockoutStart && !/^\d{1,2}:\d{2}$/.test(settings.lockoutStart)) settings.lockoutStart = site.defaults.lockoutStart;
    if (settings.lockoutEnd && !/^\d{1,2}:\d{2}$/.test(settings.lockoutEnd)) settings.lockoutEnd = site.defaults.lockoutEnd;
    if (settings.logoUrl && !/^https:\/\/[^\s"'<>]+$/.test(settings.logoUrl)) settings.logoUrl = '';
    await settings.save();

    if (before.weeklyGoal !== undefined && before.weeklyGoal !== settings.weeklyGoal) await targetSvc.setWeeklyGoal(settings.weeklyGoal);
    if (before.plotsCount !== undefined && before.plotsCount !== settings.plotsCount) await farmSvc.ensurePlots();

    await logAudit({ actor: req.user, action: 'settings.update', targetType: 'settings', targetId: 'site', before, after: body, ip: req.ip });
    res.json({ settings, message: site.strings.admin.settingsSaved });
  })
);

router.post(
  '/upload',
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw fail(400, site.strings.errors.validation, 'VALIDATION');
    const result = await uploadBuffer(req.file.buffer, 'colombia/products');
    await logAudit({ actor: req.user, action: 'upload.image', targetType: 'asset', targetId: result.public_id, after: { url: result.secure_url }, ip: req.ip });
    res.status(201).json({ url: result.secure_url, publicId: result.public_id });
  })
);

module.exports = router;
