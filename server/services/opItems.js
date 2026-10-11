'use strict';

const mongoose = require('mongoose');

function round2(n) {
  return Math.round(n * 100) / 100;
}

function linesTotal(lines) {
  return round2((lines || []).reduce((a, l) => a + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0));
}

async function buildLines(ItemModel, raw, previous) {
  const list = Array.isArray(raw) ? raw.slice(0, 60) : [];
  const ids = [];
  for (const l of list) {
    if (l && mongoose.isValidObjectId(l.itemId)) ids.push(String(l.itemId));
  }
  const found = ids.length ? await ItemModel.find({ _id: { $in: ids } }) : [];
  const byId = new Map(found.map((i) => [String(i._id), i]));
  const prevById = new Map((previous || []).map((l) => [String(l.item), l]));
  const merged = new Map();

  for (const l of list) {
    if (!l || !mongoose.isValidObjectId(l.itemId)) continue;
    const qty = Math.floor(Number(l.qty));
    if (!Number.isFinite(qty) || qty < 1 || qty > 100000) continue;
    const key = String(l.itemId);
    const prev = prevById.get(key);
    const item = byId.get(key);
    let line = null;
    if (prev) {
      line = { item: prev.item, name: prev.name, category: prev.category, unitPrice: prev.unitPrice, qty: 0 };
    } else if (item) {
      line = { item: item._id, name: item.name, category: item.category, unitPrice: item.price, qty: 0 };
    }
    if (!line) continue;
    const existing = merged.get(key) || line;
    existing.qty = Math.min(100000, existing.qty + qty);
    merged.set(key, existing);
  }
  return Array.from(merged.values());
}

function serializeLines(lines) {
  return (lines || []).map((l) => ({
    itemId: l.item ? String(l.item) : '',
    name: l.name,
    category: l.category,
    unitPrice: l.unitPrice,
    qty: l.qty,
    total: round2((l.qty || 0) * (l.unitPrice || 0))
  }));
}

module.exports = { buildLines, linesTotal, serializeLines, round2 };
