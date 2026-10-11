'use strict';

const { DutySession, HourAdjustment } = require('../models');
const time = require('../utils/time');

const sumOf = (agg) => (agg[0] ? agg[0].m : 0);

async function minutesFor(userId) {
  const week = time.weekBounds();
  const [sessAll, sessWeek, adjAll, adjWeek] = await Promise.all([
    DutySession.aggregate([{ $match: { user: userId } }, { $group: { _id: null, m: { $sum: '$durationMin' } } }]),
    DutySession.aggregate([
      { $match: { user: userId, start: { $gte: week.start, $lt: week.end } } },
      { $group: { _id: null, m: { $sum: '$durationMin' } } }
    ]),
    HourAdjustment.aggregate([{ $match: { user: userId } }, { $group: { _id: null, m: { $sum: '$minutes' } } }]),
    HourAdjustment.aggregate([
      { $match: { user: userId, createdAt: { $gte: week.start, $lt: week.end } } },
      { $group: { _id: null, m: { $sum: '$minutes' } } }
    ])
  ]);
  return {
    weekMin: Math.max(0, sumOf(sessWeek) - sumOf(adjWeek)),
    totalMin: Math.max(0, sumOf(sessAll) - sumOf(adjAll))
  };
}

async function weekAdjustmentMin(userId) {
  const week = time.weekBounds();
  const agg = await HourAdjustment.aggregate([
    { $match: { user: userId, createdAt: { $gte: week.start, $lt: week.end } } },
    { $group: { _id: null, m: { $sum: '$minutes' } } }
  ]);
  return sumOf(agg);
}

async function totalAdjustmentMin(userId) {
  const agg = await HourAdjustment.aggregate([{ $match: { user: userId } }, { $group: { _id: null, m: { $sum: '$minutes' } } }]);
  return sumOf(agg);
}

async function adjustmentsByUser() {
  const rows = await HourAdjustment.aggregate([{ $group: { _id: '$user', m: { $sum: '$minutes' } } }]);
  return new Map(rows.map((r) => [String(r._id), r.m]));
}

module.exports = { minutesFor, weekAdjustmentMin, totalAdjustmentMin, adjustmentsByUser };
