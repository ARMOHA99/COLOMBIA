'use strict';

const mongoose = require('mongoose');

const itemLineSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item' },
    name: { type: String, default: '' },
    category: { type: String, default: '' },
    unitPrice: { type: Number, default: 0, min: 0 },
    qty: { type: Number, default: 1, min: 1 }
  },
  { _id: false }
);

const operationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    typeKey: { type: String, required: true },
    typeLabel: { type: String, default: '' },
    date: { type: Date, default: Date.now },
    result: { type: String, enum: ['win', 'loss', 'pending'], default: 'pending', index: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    notes: { type: String, default: '', maxlength: 1000 },
    winAmount: { type: Number, default: 0, min: 0 },
    lossAmount: { type: Number, default: 0, min: 0 },
    lostItems: { type: [itemLineSchema], default: [] },
    wonItems: { type: [itemLineSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

operationSchema.index({ date: -1 });

module.exports = mongoose.models.Operation || mongoose.model('Operation', operationSchema);
