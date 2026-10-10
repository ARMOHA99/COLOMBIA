'use strict';

const { Server } = require('socket.io');
const site = require('../../config/site');
const env = require('../../config/env');
const { User } = require('../models');
const rolesSvc = require('../services/roles');
const bus = require('../services/bus');
const logger = require('../services/logger');

const SESSION_COOKIE = 'colombia.sid';

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const pair of String(header).split(';')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    let value = pair.slice(idx + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {}
    out[key] = value;
  }
  return out;
}

function sidFromCookie(raw) {
  if (!raw) return null;
  let value = raw.trim();
  if (value.startsWith('s:')) value = value.slice(2);
  const dot = value.indexOf('.');
  if (dot !== -1) value = value.slice(0, dot);
  return value || null;
}

function storeGet(store, sid) {
  return new Promise((resolve) => {
    if (!store || !sid) return resolve(null);
    let settled = false;
    const done = (sess) => {
      if (!settled) {
        settled = true;
        resolve(sess || null);
      }
    };
    try {
      const maybe = store.get(sid, (err, sess) => done(err ? null : sess));
      if (maybe && typeof maybe.then === 'function') maybe.then(done).catch(() => done(null));
      else if (maybe && typeof maybe === 'object') done(maybe);
      else setTimeout(() => done(null), 3000);
    } catch {
      done(null);
    }
  });
}

function roomsFor(user) {
  const rooms = [`user:${user.discordId}`, 'scope:all'];
  const rank = user.rank;
  const value = rolesSvc.rankValue(rank);
  if (value >= 1) rooms.push('scope:shop');
  if (value >= 2) rooms.push('scope:members');
  if (value >= 3) rooms.push('scope:staff');
  if (value >= 4) rooms.push('scope:admin');
  if (rolesSvc.hasShopDuty(user) && !rooms.includes('scope:shop')) rooms.push('scope:shop');
  return rooms;
}

function initSockets(httpServer, sessionStore) {
  const io = new Server(httpServer, {
    cors: { origin: env.baseUrl, credentials: true },
    serveClient: false,
    transports: ['websocket', 'polling']
  });

  io.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      const sid = sidFromCookie(cookies[SESSION_COOKIE]);
      if (!sid) return next(new Error('unauthorized'));
      const sess = await storeGet(sessionStore, sid);
      if (!sess || !sess.userId) return next(new Error('unauthorized'));
      const user = await User.findById(sess.userId);
      if (!user || user.banned || user.rank === 'guest') return next(new Error('revoked'));
      socket.data.sid = sid;
      socket.data.user = user;
      socket.data.discordId = user.discordId;
      socket.data.rooms = roomsFor(user);
      return next();
    } catch (err) {
      logger.error('socket auth:', err.message);
      return next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const joinAll = (rooms) => {
      for (const room of rooms) socket.join(room);
    };
    joinAll(socket.data.rooms || []);

    const revalidate = setInterval(async () => {
      try {
        const sess = await storeGet(sessionStore, socket.data.sid);
        if (!sess || !sess.userId) {
          socket.emit('session:revoked', { reason: site.strings.auth.kicked });
          socket.disconnect(true);
          return;
        }
        const user = await User.findById(sess.userId);
        if (!user || user.banned || user.rank === 'guest') {
          socket.emit('session:revoked', { reason: site.strings.auth.kicked });
          socket.disconnect(true);
          return;
        }
        const fresh = await rolesSvc.ensureFreshRoles(user);
        if (!fresh || fresh.rank === 'guest') {
          socket.emit('session:revoked', { reason: site.strings.auth.kicked });
          socket.disconnect(true);
          return;
        }
        const nextRooms = roomsFor(fresh);
        const prevRooms = socket.data.rooms || [];
        if (JSON.stringify([...nextRooms].sort()) !== JSON.stringify([...prevRooms].sort())) {
          for (const room of prevRooms) if (!nextRooms.includes(room)) socket.leave(room);
          for (const room of nextRooms) if (!prevRooms.includes(room)) socket.join(room);
          socket.data.rooms = nextRooms;
          socket.emit('user:updated', rolesSvc.publicUser(fresh));
        }
      } catch (err) {
        logger.error('socket revalidate:', err.message);
      }
    }, 5 * 60 * 1000);

    socket.on('disconnect', () => clearInterval(revalidate));
    socket.on('ping', (cb) => {
      if (typeof cb === 'function') cb({ t: Date.now() });
    });
  });

  bus.on('notify', ({ room, event, data }) => {
    if (!room || !event) return;
    io.to(room).emit(event, data);
    if (event === 'session:revoked' && String(room).startsWith('user:')) {
      const discordId = String(room).slice(5);
      setTimeout(() => {
        for (const s of io.sockets.sockets.values()) {
          if (s.data && s.data.discordId === discordId) s.disconnect(true);
        }
      }, 400);
    }
  });

  logger.info('socket.io initialized');
  return io;
}

module.exports = { initSockets, SESSION_COOKIE };
