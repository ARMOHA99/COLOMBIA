'use strict';

const { User, DutySession, Settings } = require('../models');
const permissionsSvc = require('./permissions');
const rolesSvc = require('./roles');
const time = require('../utils/time');

const DAY = 24 * 60 * 60 * 1000;
const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const pad = (n) => String(n).padStart(2, '0');

function windowSpec(settings) {
  if (!settings.lockoutEnabled) return { enabled: false, startMin: 0, lenMin: 1440, label: 'اليوم كاملاً (00:00 – 24:00)' };
  const startMin = time.toMinutes(settings.lockoutEnd);
  let lenMin = time.toMinutes(settings.lockoutStart) - startMin;
  if (lenMin <= 0) lenMin += 1440;
  return { enabled: true, startMin, lenMin, label: `من ${settings.lockoutEnd} إلى ${settings.lockoutStart}` };
}

function dayWindow(dateUtcMs, spec) {
  const startZ = new Date(dateUtcMs + spec.startMin * 60000);
  const endZ = new Date(startZ.getTime() + spec.lenMin * 60000);
  return { start: time.fromZoned(startZ), end: time.fromZoned(endZ) };
}

function dayDates(range, offset, spec, now) {
  if (range === 'month') {
    const z = time.toZoned(now).getTime();
    const latest = Math.floor((z - spec.startMin * 60000) / DAY) * DAY;
    return Array.from({ length: 30 }, (_, i) => latest - (29 - i) * DAY);
  }
  const bounds = time.weekBounds(new Date(now.getTime() + offset * 7 * DAY));
  const startZ = time.toZoned(bounds.start).getTime();
  let base = Math.floor(startZ / DAY) * DAY;
  if (base + spec.startMin * 60000 < startZ) base += DAY;
  return Array.from({ length: 7 }, (_, i) => base + i * DAY);
}

async function buildPresence({ range = 'week', offset = 0, now = new Date() } = {}) {
  const settings = await Settings.getInstance();
  const spec = windowSpec(settings);
  const safeOffset = Math.max(-52, Math.min(0, Math.floor(Number(offset) || 0)));
  const dates = dayDates(range === 'month' ? 'month' : 'week', safeOffset, spec, now);
  const windows = dates.map((d) => dayWindow(d, spec));
  const rangeStart = windows[0].start;
  const rangeEnd = windows[windows.length - 1].end;

  const days = dates.map((d, i) => {
    const date = new Date(d);
    const w = windows[i];
    const state = now >= w.end ? 'past' : now >= w.start ? 'current' : 'future';
    return { key: `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`, weekday: AR_DAYS[date.getUTCDay()], date: `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}`, start: w.start, end: w.end, state };
  });

  const allUsers = await User.find({ rank: { $ne: 'guest' }, banned: false })
    .select('globalName username avatar rank roleLabel roles discordId joinedAt createdAt')
    .limit(500);
  const users = allUsers.filter((u) => permissionsSvc.permsOf(u).has('view.attendance'));

  const sessions = await DutySession.find({
    start: { $lt: rangeEnd },
    $or: [{ end: { $gt: rangeStart } }, { open: true }]
  })
    .select('user start end open')
    .lean();
  const byUser = new Map();
  for (const s of sessions) {
    const key = String(s.user);
    if (!byUser.has(key)) byUser.set(key, []);
    byUser.get(key).push(s);
  }

  const rows = users.map((u) => {
    const mine = byUser.get(String(u._id)) || [];
    const joined = (u.joinedAt || u.createdAt || new Date(0)).getTime();
    let total = 0;
    const cells = windows.map((w) => {
      if (w.start > now) return 'future';
      if (w.end.getTime() <= joined) return 'none';
      const present = mine.some((s) => s.start < w.end && (s.end ? s.end > w.start : true));
      if (present) {
        total += 1;
        return 'yes';
      }
      return now < w.end ? 'pending' : 'no';
    });
    return { id: String(u._id), name: u.displayName(), avatar: u.avatarUrl(64), rankLabel: rolesSvc.rankLabelOf(u), cells, total };
  });
  rows.sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  return {
    range: range === 'month' ? 'month' : 'week',
    offset: safeOffset,
    window: { enabled: spec.enabled, label: spec.label },
    weekStartDay: settings.weekStartDay,
    days,
    users: rows
  };
}

module.exports = { buildPresence, windowSpec, dayDates, dayWindow };
