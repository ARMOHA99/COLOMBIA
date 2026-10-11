'use strict';

const mongoose = require('mongoose');

const hourAdjustmentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    minutes: { type: Number, required: true, min: 1 },
    reason: { type: String, default: '', maxlength: 300 },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

hourAdjustmentSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.models.HourAdjustment || mongoose.model('HourAdjustment', hourAdjustmentSchema);
