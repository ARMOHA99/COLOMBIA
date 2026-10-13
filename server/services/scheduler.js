'use strict';

const farm = require('./farm');
const target = require('./target');
const roles = require('./roles');
const logger = require('./logger');
const { DutySession, Settings } = require('../models');
const duty = require('./duty');
const time = require('../utils/time');

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
    duty.closeOpenBreak(s, s.end);
    s.durationMin = duty.netMinutes(s);
    s.open = false;
    await s.save();
  }
  if (stale.length) logger.info(`closed ${stale.length} stale duty session(s)`);
}

async function closeLockedSessions(now = new Date()) {
  const settings = await Settings.getInstance();
  if (!settings.lockoutEnabled) return 0;
  if (!time.isLockoutActive(now, settings.lockoutStart, settings.lockoutEnd)) return 0;
  const lockStart = time.lastOccurrence(now, settings.lockoutStart);
  const open = await DutySession.find({ open: true });
  for (const s of open) {
    const end = s.start.getTime() > lockStart.getTime() ? now : lockStart;
    duty.closeSession(s, end);
    await s.save();
  }
  if (open.length) logger.info(`lockout: closed ${open.length} duty session(s)`);
  return open.length;
}

async function start() {
  await closeStaleDutySessions();
  await closeLockedSessions().catch((err) => logger.error('closeLockedSessions:', err.message));
  await farm.ensurePlots().catch((err) => logger.error('ensurePlots:', err.message));
  await target.getCurrentTarget().catch((err) => logger.error('target init:', err.message));
  await target.recomputeTarget({ emit: false }).catch(() => {});

  every(() => farm.checkReadiness(), 30 * 1000, 'farm');
  every(() => closeLockedSessions(), 60 * 1000, 'lockout');
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

module.exports = { start, stop, closeStaleDutySessions, closeLockedSessions };
