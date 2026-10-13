'use strict';

function breakMs(session, nowMs = Date.now()) {
  const sStart = new Date(session.start).getTime();
  const sEnd = session.end ? new Date(session.end).getTime() : nowMs;
  let total = 0;
  for (const b of session.breaks || []) {
    const bs = Math.max(new Date(b.start).getTime(), sStart);
    const be = Math.min(b.end ? new Date(b.end).getTime() : sEnd, sEnd);
    if (be > bs) total += be - bs;
  }
  return total;
}

function netMinutes(session, nowMs = Date.now()) {
  const end = session.end ? new Date(session.end).getTime() : nowMs;
  const gross = end - new Date(session.start).getTime();
  return Math.max(0, Math.round((gross - breakMs(session, nowMs)) / 60000));
}

function breakMinutes(session, nowMs = Date.now()) {
  return Math.round(breakMs(session, nowMs) / 60000);
}

function openBreak(session) {
  return (session.breaks || []).find((b) => !b.end) || null;
}

function closeOpenBreak(session, at = new Date()) {
  const b = openBreak(session);
  if (b) b.end = at;
  return b;
}

function closeSession(session, endAt = new Date()) {
  closeOpenBreak(session, endAt);
  session.end = endAt;
  session.durationMin = netMinutes(session);
  session.open = false;
  return session;
}

module.exports = { breakMs, netMinutes, breakMinutes, openBreak, closeOpenBreak, closeSession };
