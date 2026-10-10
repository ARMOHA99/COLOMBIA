'use strict';

const path = require('path');
const http = require('http');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const helmet = require('helmet');
const compression = require('compression');

const env = require('../config/env');
const site = require('../config/site');
const { connectDB } = require('./db');
const logger = require('./services/logger');
const build = require('./services/build');
const scheduler = require('./services/scheduler');
const { startBot, stopBot } = require('./services/bot');
const rolesSvc = require('./services/roles');
const { initSockets, SESSION_COOKIE } = require('./sockets');
const apiRoutes = require('./routes');
const { globalLimiter, sanitize } = require('./middleware/security');
const { loadSessionUser } = require('./middleware/auth');
const { notFound, errorHandler } = require('./middleware/errors');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const VENDOR_DIRS = {
  '/vendor/three.module.js': path.join(__dirname, '..', 'node_modules', 'three', 'build', 'three.module.js'),
  '/vendor/three.core.js': path.join(__dirname, '..', 'node_modules', 'three', 'build', 'three.core.js'),
  '/vendor/chart.umd.js': path.join(__dirname, '..', 'node_modules', 'chart.js', 'dist', 'chart.umd.js'),
  '/vendor/socket.io.js': path.join(__dirname, '..', 'node_modules', 'socket.io', 'client-dist', 'socket.io.js')
};

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          'font-src': ["'self'", 'https://fonts.gstatic.com'],
          'img-src': ["'self'", 'data:', 'blob:', 'https://cdn.discordapp.com', 'https://res.cloudinary.com'],
          'connect-src': ["'self'", 'ws:', 'wss:'],
          'object-src': ["'none'"],
          'frame-ancestors': ["'none'"],
          'base-uri': ["'self'"],
          'form-action': ["'self'"],
          ...(env.isProd ? { 'upgrade-insecure-requests': [] } : {})
        }
      },
      crossOriginEmbedderPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: env.isProd ? undefined : false
    })
  );
  app.use(compression());
  app.use(globalLimiter);

  const store = MongoStore.create({
    mongoUrl: env.mongo.uri,
    ttl: Math.round(env.security.sessionTtlMs / 1000),
    autoRemoveInterval: 10,
    touchAfter: 60
  });

  const sessionMiddleware = session({
    secret: env.sessionSecret,
    resave: false,
    saveUninitialized: false,
    store,
    name: SESSION_COOKIE,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.security.cookiesSecure,
      maxAge: env.security.sessionTtlMs,
      path: '/'
    }
  });

  app.use('/api', express.json({ limit: '1mb' }));
  app.use('/api', express.urlencoded({ extended: true, limit: '1mb' }));
  app.use('/api', sanitize);
  app.use('/api', sessionMiddleware);
  app.use('/api', loadSessionUser);

  app.use(express.static(PUBLIC_DIR, { index: false, maxAge: 0, etag: true, lastModified: true }));
  for (const [route, file] of Object.entries(VENDOR_DIRS)) {
    app.get(route, (req, res) => res.sendFile(file));
  }

  app.use('/api', apiRoutes);
  app.use('/api', notFound);

  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

  app.use(errorHandler);

  return { app, store, sessionMiddleware };
}

async function main() {
  await connectDB();
  logger.info('MongoDB connected');
  logger.info(`build id: ${build.getBuildId()}`);
  if (!env.discord.configured) logger.warn('Discord is NOT configured — OAuth login will be unavailable.');
  if (!env.cloudinary.configured) logger.warn('Cloudinary is NOT configured — image uploads will be disabled.');

  const { app, store, sessionMiddleware } = createApp();
  const server = http.createServer(app);
  const io = initSockets(server, store);

  rolesSvc.registry.init(store);

  await scheduler.start();
  await startBot();

  server.listen(env.port, () => {
    logger.info(`${site.org.name} portal listening on :${env.port} (${env.baseUrl})`);
  });

  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received — shutting down...`);
    scheduler.stop();
    stopBot();
    try {
      io.close();
    } catch {}
    server.close(async () => {
      try {
        const mongoose = require('mongoose');
        await mongoose.disconnect();
      } catch {}
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 8000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', (err) => logger.error('unhandledRejection:', err && err.stack ? err.stack : err));
  process.on('uncaughtException', (err) => logger.error('uncaughtException:', err && err.stack ? err.stack : err));

  return { app, server, io };
}

if (require.main === module) {
  main().catch((err) => {
    logger.error('Fatal startup error:', err && err.stack ? err.stack : err);
    process.exit(1);
  });
}

module.exports = { main, createApp };
