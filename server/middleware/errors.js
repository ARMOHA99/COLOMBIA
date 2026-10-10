'use strict';

const site = require('../../config/site');
const logger = require('../services/logger');

function notFound(req, res) {
  res.status(404).json({ error: site.strings.errors.notFound, code: 'NOT_FOUND' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || (err.name === 'ValidationError' ? 400 : err.name === 'CastError' ? 400 : 500);
  const message =
    err.code === 'UPLOAD_TYPE'
      ? site.strings.errors.uploadType
      : err.code === 'UPLOAD_SIZE'
        ? site.strings.errors.uploadSize
        : err.code && status < 500
          ? err.message
          : status >= 500
            ? site.strings.errors.server
            : err.message;

  if (status >= 500) logger.error(`[${req.method} ${req.originalUrl}]`, err.stack || err.message);
  else logger.warn(`[${req.method} ${req.originalUrl}] ${status} ${err.message}`);

  res.status(status).json({ error: message, code: err.code || 'ERROR' });
}

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function fail(status, message, code) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

module.exports = { notFound, errorHandler, asyncHandler, fail };
