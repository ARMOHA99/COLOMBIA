'use strict';

const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const site = require('../../config/site');

const json = (req) => ({ error: site.strings.errors.rateLimit });

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1200,
  standardHeaders: true,
  legacyHeaders: false,
  message: json
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: json
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: json
});

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: json
});

module.exports = {
  globalLimiter,
  authLimiter,
  uploadLimiter,
  writeLimiter,
  sanitize: mongoSanitize()
};
