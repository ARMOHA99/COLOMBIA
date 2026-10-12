'use strict';

const { Operation, DutySession, Discipline, InternalPurchase, HourAdjustment, Order } = require('../models');
const hoursSvc = require('./hours');
const rolesSvc = require('./roles');
const duty = require('./duty');
const time = require('../utils/time');
const site = require('../../config/site');

async function buildCard(user) {
  const since = user.joinedAt || user.createdAt;
  const [opsCount, wins, losses, missedOps, warnings, dutyAgg, oldGear, newGear, discipline] = await Promise.all([
    Operation.countDocuments({ participants: user._id }),
    Operation.countDocuments({ participants: user._id, result: 'win' }),
    Operation.countDocuments({ participants: user._id, result: 'loss' }),
    Operation.countDocuments({ date: { $gte: since }, participants: { $ne: user._id } }),
    Discipline.countDocuments({ user: user._id, kind: { $in: ['warning', 'fine'] } }),
    DutySession.aggregate([{ $match: { user: user._id } }, { $group: { _id: null, minutes: { $sum: '$durationMin' } } }]),
    InternalPurchase.aggregate([{ $match: { user: user._id } }, { $group: { _id: '$itemName', qty: { $sum: '$qty' } } }]),
    Order.aggregate([
      { $match: { user: user._id, kind: 'internal', status: 'delivered' } },
      { $unwind: '$items' },
      { $group: { _id: '$items.name', qty: { $sum: '$items.qty' } } }
    ]),
    Discipline.find({ user: user._id }).sort({ createdAt: -1 }).limit(10).populate('by', 'globalName username')
  ]);

  const minutes = Math.max(0, (dutyAgg[0] ? dutyAgg[0].minutes : 0) - (await hoursSvc.totalAdjustmentMin(user._id)));
  const totalOps = opsCount + missedOps;

  const gearMap = new Map();
  for (const g of [...oldGear, ...newGear]) gearMap.set(g._id, (gearMap.get(g._id) || 0) + g.qty);
  const gear = Array.from(gearMap.entries())
    .map(([name, qty]) => ({ name, qty }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 12);

  return {
    id: String(user._id),
    name: user.displayName(),
    avatar: user.avatarUrl(256),
    discordId: user.discordId,
    rank: user.rank,
    rankLabel: rolesSvc.rankLabelOf(user),
    inGameId: user.inGameId || '—',
    joinedAt: user.joinedAt,
    opsCount,
    wins,
    losses,
    missedOps,
    warnings,
    participationRate: totalOps ? Math.round((opsCount / totalOps) * 100) : 0,
    dutyHours: Math.round((minutes / 60) * 10) / 10,
    gear,
    discipline: discipline.map((d) => ({
      id: String(d._id),
      kind: d.kind,
      kindLabel: site.statuses.disciplineKinds[d.kind] || d.kind,
      text: d.text,
      amount: d.amount,
      by: d.by && d.by.displayName ? d.by.displayName() : '',
      createdAt: d.createdAt
    }))
  };
}

function periodBounds(period) {
  const week = time.weekBounds();
  const DAY = 24 * 60 * 60 * 1000;
  if (period === 'lastweek') return { start: new Date(week.start.getTime() - 7 * DAY), end: week.start };
  if (period === 'month') return { start: new Date(Date.now() - 30 * DAY), end: new Date(Date.now() + DAY) };
  if (period === 'all') return { start: null, end: null };
  return { start: week.start, end: week.end };
}

async function attendanceLog(user, period) {
  const { start, end } = periodBounds(period);
  const match = { user: user._id };
  const adjMatch = { user: user._id };
  if (start && end) {
    match.start = { $gte: start, $lt: end };
    adjMatch.createdAt = { $gte: start, $lt: end };
  }
  const [sessions, adjustments] = await Promise.all([
    DutySession.find(match).sort({ start: -1 }).limit(500),
    HourAdjustment.find(adjMatch).sort({ createdAt: -1 }).limit(100)
  ]);

  const rows = sessions.map((s) => ({
    id: String(s._id),
    start: s.start,
    end: s.end,
    open: s.open,
    workMin: duty.netMinutes(s),
    breakMin: duty.breakMinutes(s),
    breaks: (s.breaks || []).map((b) => ({
      start: b.start,
      end: b.end,
      min: Math.round(
        Math.max(0, (b.end ? new Date(b.end).getTime() : Date.now()) - new Date(b.start).getTime()) / 60000
      )
    }))
  }));
  const workMin = rows.reduce((a, r) => a + r.workMin, 0);
  const breakMin = rows.reduce((a, r) => a + r.breakMin, 0);
  const penaltyMin = adjustments.reduce((a, r) => a + r.minutes, 0);

  return {
    period: period || 'week',
    totals: { sessions: rows.length, workMin, breakMin, penaltyMin, netMin: Math.max(0, workMin - penaltyMin) },
    sessions: rows,
    adjustments: adjustments.map((a) => ({ minutes: a.minutes, reason: a.reason, at: a.createdAt }))
  };
}

module.exports = { buildCard, attendanceLog };
