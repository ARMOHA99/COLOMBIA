'use strict';

const mongoose = require('mongoose');

const internalPurchaseSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'InternalItem' },
    itemName: { type: String, required: true },
    qty: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    balanceAfter: { type: Number, default: 0 }
  },
  { timestamps: true }
);

internalPurchaseSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.models.InternalPurchase || mongoose.model('InternalPurchase', internalPurchaseSchema);
