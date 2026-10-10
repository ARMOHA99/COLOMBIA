'use strict';

const farm = require('./farm');
const target = require('./target');
const roles = require('./roles');
const logger = require('./logger');
const { DutySession } = require('../models');

const timers = [];
const every = (fn, ms, label) => {
  const t = setInterval(() => {
    fn().catch((err) => logger.error(`scheduler[${label}]:`, err.message));
  }, ms);
  timers.push(t);
  return t;
};

async function closeStaleDutySessions() {
  const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const stale = await DutySession.find({ open: true, start: { $lt: cutoff } });
  for (const s of stale) {
    s.end = new Date(s.start.getTime() + 12 * 60 * 60 * 1000);
    s.durationMin = 720;
    s.open = false;
    await s.save();
  }
  if (stale.length) logger.info(`closed ${stale.length} stale duty session(s)`);
}

async function start() {
  await closeStaleDutySessions();
  await farm.ensurePlots().catch((err) => logger.error('ensurePlots:', err.message));
  await target.getCurrentTarget().catch((err) => logger.error('target init:', err.message));
  await target.recomputeTarget({ emit: false }).catch(() => {});

  every(() => farm.checkReadiness(), 30 * 1000, 'farm');
  every(() => target.getCurrentTarget(), 60 * 1000, 'rollover');
  every(() => roles.reconcileAll(), 5 * 60 * 1000, 'reconcile');
  setTimeout(() => {
    roles
      .reconcileAll()
      .then((r) => r.changed && logger.info(`reconcile: ${r.changed} user(s) updated`))
      .catch((err) => logger.error('reconcile:', err.message));
  }, 15 * 1000);
  logger.info('scheduler started');
}

function stop() {
  while (timers.length) clearInterval(timers.pop());
}

module.exports = { start, stop, closeStaleDutySessions };
