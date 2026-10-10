'use strict';

const { WeeklyTarget, Operation, Settings } = require('../models');
const time = require('../utils/time');
const bus = require('./bus');
const logger = require('./logger');

function serialize(doc) {
  if (!doc) return null;
  const goal = doc.goal || 0;
  const percent = goal > 0 ? Math.min(100, Math.round((doc.score / goal) * 100)) : 0;
  return {
    id: String(doc._id),
    weekKey: doc.weekKey,
    weekStart: doc.weekStart,
    weekEnd: doc.weekEnd,
    goal,
    score: doc.score,
    wins: doc.wins,
    losses: doc.losses,
    percent,
    remaining: Math.max(0, goal - doc.score),
    completed: goal > 0 && doc.score >= goal,
    completedAt: doc.completedAt,
    glowing: percent > 90
  };
}

async function getCurrentTarget({ allowRollover = true } = {}) {
  const key = time.weekKey();
  let doc = await WeeklyTarget.findOne({ scope: 'current' });

  if (doc && doc.weekKey !== key && allowRollover) {
    doc.scope = 'archived';
    doc.archivedAt = new Date();
    await doc.save();
    bus.emit('notify', { room: 'scope:members', event: 'target:archived', data: serialize(doc) });
    doc = null;
  }

  if (!doc) {
    const bounds = time.weekBounds();
    const settings = await Settings.getInstance();
    doc = await WeeklyTarget.findOneAndUpdate(
      { scope: 'current' },
      {
        $setOnInsert: {
          scope: 'current',
          weekKey: key,
          weekStart: bounds.start,
          weekEnd: bounds.end,
          goal: settings.weeklyGoal,
          score: 0,
          wins: 0,
          losses: 0,
          completedAt: null
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } else if (doc.goal === 0 || doc.goal === undefined) {
    const settings = await Settings.getInstance();
    doc.goal = settings.weeklyGoal;
    await doc.save();
  }
  return doc;
}

async function recomputeTarget({ emit = true } = {}) {
  try {
    const doc = await getCurrentTarget();
    const agg = await Operation.aggregate([
      { $match: { date: { $gte: doc.weekStart, $lt: doc.weekEnd }, result: { $in: ['win', 'loss'] } } },
      { $group: { _id: '$result', count: { $sum: 1 } } }
    ]);
    let wins = 0;
    let losses = 0;
    for (const row of agg) {
      if (row._id === 'win') wins = row.count;
      if (row._id === 'loss') losses = row.count;
    }
    const score = Math.max(0, wins - losses);
    const wasCompleted = Boolean(doc.completedAt);
    doc.wins = wins;
    doc.losses = losses;
    doc.score = score;
    doc.completedAt = score >= doc.goal && doc.goal > 0 ? (wasCompleted ? doc.completedAt : new Date()) : null;
    await doc.save();
    const data = serialize(doc);
    if (emit) bus.emit('notify', { room: 'scope:members', event: 'target:updated', data });
    return data;
  } catch (err) {
    logger.error('recomputeTarget failed:', err.message);
    return null;
  }
}

async function setWeeklyGoal(goal) {
  const settings = await Settings.getInstance();
  settings.weeklyGoal = Math.max(0, Number(goal) || 0);
  await settings.save();
  const doc = await getCurrentTarget();
  doc.goal = settings.weeklyGoal;
  if (doc.score < doc.goal) doc.completedAt = null;
  await doc.save();
  const data = serialize(doc);
  bus.emit('notify', { room: 'scope:members', event: 'target:updated', data });
  return data;
}

async function history() {
  const docs = await WeeklyTarget.find({ scope: 'archived' }).sort({ weekStart: -1 }).limit(24);
  return docs.map(serialize);
}

module.exports = { serialize, getCurrentTarget, recomputeTarget, setWeeklyGoal, history };
