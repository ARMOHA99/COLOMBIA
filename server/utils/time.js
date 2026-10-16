'use strict';

const TZ = 'Africa/Algiers';

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
});

function wallAsUtc(date) {
  const p = {};
  for (const part of partsFmt.formatToParts(date)) p[part.type] = part.value;
  const hour = p.hour === '24' ? 0 : +p.hour;
  return Date.UTC(+p.year, +p.month - 1, +p.day, hour, +p.minute, +p.second);
}

function tzOffsetMs(date) {
  return wallAsUtc(date) - Math.floor(date.getTime() / 1000) * 1000;
}

function toZoned(date = new Date()) {
  return new Date(date.getTime() + tzOffsetMs(date));
}

function fromZoned(zonedDate) {
  let ms = zonedDate.getTime() - tzOffsetMs(new Date(zonedDate.getTime()));
  ms = zonedDate.getTime() - tzOffsetMs(new Date(ms));
  return new Date(ms);
}

let weekCfg = { day: 1, minutes: 0 };

function setWeekConfig(cfg = {}) {
  const day = Number(cfg.day);
  const minutes = Number(cfg.minutes);
  weekCfg = {
    day: Number.isInteger(day) && day >= 0 && day <= 6 ? day : 1,
    minutes: Number.isFinite(minutes) && minutes >= 0 && minutes < 1440 ? Math.floor(minutes) : 0
  };
}

function getWeekConfig() {
  return { ...weekCfg };
}

function weekBounds(date = new Date()) {
  const z = toZoned(date);
  const minutesNow = z.getUTCHours() * 60 + z.getUTCMinutes();
  let diff = (z.getUTCDay() - weekCfg.day + 7) % 7;
  if (diff === 0 && minutesNow < weekCfg.minutes) diff = 7;
  const startZoned = new Date(
    Date.UTC(z.getUTCFullYear(), z.getUTCMonth(), z.getUTCDate() - diff, Math.floor(weekCfg.minutes / 60), weekCfg.minutes % 60)
  );
  const endZoned = new Date(startZoned.getTime() + 7 * 24 * 60 * 60 * 1000);
  return { start: fromZoned(startZoned), end: fromZoned(endZoned) };
}

function weekKey(date = new Date()) {
  const z = toZoned(weekBounds(date).start);
  const pad = (n) => String(n).padStart(2, '0');
  return `${z.getUTCFullYear()}-${pad(z.getUTCMonth() + 1)}-${pad(z.getUTCDate())}`;
}

function hhmm(date = new Date()) {
  const z = toZoned(date);
  return `${String(z.getUTCHours()).padStart(2, '0')}:${String(z.getUTCMinutes()).padStart(2, '0')}`;
}

function minutesOfDay(date = new Date()) {
  const z = toZoned(date);
  return z.getUTCHours() * 60 + z.getUTCMinutes();
}

function toMinutes(hhmmStr) {
  const [h, m] = String(hhmmStr || '0:0').split(':').map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
}

function isLockoutActive(now = new Date(), startStr = '22:00', endStr = '04:00') {
  const cur = minutesOfDay(now);
  const s = toMinutes(startStr);
  const e = toMinutes(endStr);
  if (s === e) return false;
  if (s < e) return cur >= s && cur < e;
  return cur >= s || cur < e;
}

function lastOccurrence(now = new Date(), hhmmStr = '00:00') {
  const z = toZoned(now);
  const mins = toMinutes(hhmmStr);
  let target = Date.UTC(z.getUTCFullYear(), z.getUTCMonth(), z.getUTCDate(), Math.floor(mins / 60), mins % 60);
  if (target > z.getTime()) target -= 24 * 60 * 60 * 1000;
  return fromZoned(new Date(target));
}

function formatDateTime(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('ar-DZ', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  } catch {
    return new Date(date).toISOString();
  }
}

function formatDate(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('ar-DZ', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  } catch {
    return new Date(date).toISOString().slice(0, 10);
  }
}

function relativeTime(date = new Date()) {
  const diff = Date.now() - new Date(date).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'الآن';
  if (min < 60) return `منذ ${min} دقيقة`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `منذ ${hr} ساعة`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `منذ ${day} يوم`;
  const month = Math.floor(day / 30);
  if (month < 12) return `منذ ${month} شهر`;
  return `منذ ${Math.floor(month / 12)} سنة`;
}

module.exports = {
  TZ,
  toZoned,
  fromZoned,
  weekBounds,
  weekKey,
  setWeekConfig,
  getWeekConfig,
  hhmm,
  minutesOfDay,
  toMinutes,
  isLockoutActive,
  lastOccurrence,
  formatDateTime,
  formatDate,
  relativeTime
};
