'use strict';

const { AuditLog } = require('../models');
const bus = require('./bus');
const logger = require('./logger');

async function logAudit({ actor, action, targetType = '', targetId = '', before = null, after = null, ip = '' }) {
  try {
    const doc = await AuditLog.create({
      actor: {
        id: actor && actor._id ? actor._id : null,
        name: actor && actor.displayName ? actor.displayName() : (actor && actor.name) || 'system',
        discordId: (actor && actor.discordId) || ''
      },
      action,
      targetType,
      targetId: String(targetId || ''),
      before,
      after,
      ip
    });
    bus.emit('notify', {
      room: 'scope:admin',
      event: 'audit:new',
      data: {
        action: doc.action,
        actorName: doc.actor.name,
        at: doc.at
      }
    });
    return doc;
  } catch (err) {
    logger.error('audit failed:', err.message);
    return null;
  }
}

module.exports = { logAudit };
