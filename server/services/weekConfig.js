'use strict';

const { Settings } = require('../models');
const time = require('../utils/time');

let loadedAt = 0;

async function refresh() {
  const s = await Settings.getInstance();
  time.setWeekConfig({ day: s.weekStartDay, minutes: s.lockoutEnabled ? time.toMinutes(s.lockoutStart) : 0 });
  loadedAt = Date.now();
}

async function ensure() {
  if (Date.now() - loadedAt < 30000) return;
  try {
    await refresh();
  } catch (err) {
    loadedAt = Date.now();
  }
}

module.exports = { refresh, ensure };
