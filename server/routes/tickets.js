'use strict';

const router = require('express').Router();
const { Ticket } = require('../models');
const rolesSvc = require('../services/roles');
const bus = require('../services/bus');
const { logAudit } = require('../services/audit');
const { asyncHandler, fail } = require('../middleware/errors');
const { requireAuth, requireRank } = require('../middleware/auth');
const site = require('../../config/site');

router.use(requireAuth, requireRank('member'));

function serialize(t) {
  return {
    id: String(t._id),
    type: t.type,
    typeLabel: site.statuses.ticketTypes[t.type] || t.type,
    message: t.message,
    status: t.status,
    statusLabel: site.statuses.ticket[t.status] || t.status,
    resolution: t.resolution,
    user: t.user
      ? {
          id: String(t.user._id),
          name: t.user.displayName ? t.user.displayName() : String(t.user),
          avatar: t.user.avatarUrl ? t.user.avatarUrl(64) : '',
          rank: t.user.rank
        }
      : null,
    handledBy: t.handledBy && t.handledBy.displayName ? t.handledBy.displayName() : '',
    handledAt: t.handledAt,
    createdAt: t.createdAt
  };
}

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { type, message } = req.body || {};
    if (!['leave', 'promotion', 'complaint'].includes(type) || !message) {
      throw fail(400, site.strings.errors.validation, 'VALIDATION');
    }
    const ticket = await Ticket.create({
      user: req.user._id,
      type,
      message: String(message).slice(0, 2000)
    });
    const fresh = await Ticket.findById(ticket._id).populate('user', 'globalName username avatar rank');
    bus.emit('notify', { room: 'scope:staff', event: 'ticket:new', data: serialize(fresh) });
    res.status(201).json({ ticket: serialize(fresh), message: site.strings.tickets.submitted });
  })
);

router.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const tickets = await Ticket.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('handledBy', 'globalName username');
    res.json({ tickets: tickets.map(serialize) });
  })
);

router.get(
  '/',
  requireRank('ops'),
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.userId) filter.user = req.query.userId;
    const tickets = await Ticket.find(filter)
      .sort({ createdAt: -1 })
      .limit(150)
      .populate('user', 'globalName username avatar rank')
      .populate('handledBy', 'globalName username');
    res.json({ tickets: tickets.map(serialize) });
  })
);

router.put(
  '/:id',
  requireRank('ops'),
  asyncHandler(async (req, res) => {
    const { status, resolution } = req.body || {};
    if (!['pending', 'approved', 'rejected'].includes(status)) throw fail(400, site.strings.errors.validation, 'VALIDATION');
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) throw fail(404, site.strings.errors.notFound, 'NOT_FOUND');

    const before = { status: ticket.status, resolution: ticket.resolution };
    ticket.status = status;
    ticket.resolution = resolution ? String(resolution).slice(0, 1000) : ticket.resolution;
    ticket.handledBy = req.user._id;
    ticket.handledAt = new Date();
    await ticket.save();

    await logAudit({
      actor: req.user,
      action: 'ticket.resolve',
      targetType: 'ticket',
      targetId: ticket._id,
      before,
      after: { status: ticket.status },
      ip: req.ip
    });

    const fresh = await Ticket.findById(ticket._id)
      .populate('user', 'globalName username avatar rank')
      .populate('handledBy', 'globalName username');

    if (fresh.user) {
      const owner = await require('../models').User.findById(fresh.user._id);
      if (owner) {
        bus.emit('notify', { room: `user:${owner.discordId}`, event: 'ticket:resolved', data: serialize(fresh) });
      }
    }
    bus.emit('notify', { room: 'scope:staff', event: 'ticket:updated', data: serialize(fresh) });
    res.json({ ticket: serialize(fresh) });
  })
);

module.exports = router;
