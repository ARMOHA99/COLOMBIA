'use strict';

const crypto = require('crypto');
const env = require('../../config/env');

const buildId = env.buildId || `${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;

module.exports = {
  getBuildId: () => buildId
};
