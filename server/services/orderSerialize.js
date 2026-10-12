'use strict';

const site = require('../../config/site');

function serialize(o) {
  const kind = o.kind || 'shop';
  return {
    id: String(o._id),
    kind,
    kindLabel: kind === 'internal' ? 'متجر الأعضاء' : 'المتجر',
    items: (o.items || []).map((i) => ({ name: i.name, price: i.price, qty: i.qty, total: i.price * i.qty })),
    ingameId: o.ingameId,
    note: o.note,
    total: o.total,
    status: o.status,
    statusLabel: site.statuses.order[o.status] || o.status,
    history: (o.history || []).map((h) => ({ status: h.status, label: site.statuses.order[h.status] || h.status, at: h.at })),
    user: o.user
      ? {
          id: String(o.user._id),
          name: o.user.displayName ? o.user.displayName() : String(o.user),
          avatar: o.user.avatarUrl ? o.user.avatarUrl(64) : '',
          rank: o.user.rank
        }
      : null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt
  };
}

module.exports = { serialize };
