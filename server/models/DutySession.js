'use strict';

const mongoose = require('mongoose');

const dutySessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    start: { type: Date, required: true, index: true },
    end: { type: Date, default: null },
    durationMin: { type: Number, default: 0 },
    open: { type: Boolean, default: true, index: true }
  },
  { timestamps: true }
);

dutySessionSchema.index({ user: 1, start: -1 });

module.exports = mongoose.models.DutySession || mongoose.model('DutySession', dutySessionSchema);
