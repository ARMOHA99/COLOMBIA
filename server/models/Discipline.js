'use strict';

const mongoose = require('mongoose');

const disciplineSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: ['note', 'warning', 'fine'], required: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    amount: { type: Number, default: 0, min: 0 },
    balanceBefore: { type: Number, default: null },
    balanceAfter: { type: Number, default: null },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    paid: { type: Boolean, default: false }
  },
  { timestamps: true }
);

disciplineSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Discipline || mongoose.model('Discipline', disciplineSchema);
