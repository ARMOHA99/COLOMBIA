'use strict';

const mongoose = require('mongoose');

const treasuryEntrySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['income', 'expense'], required: true, index: true },
    category: { type: String, default: 'أخرى' },
    amount: { type: Number, required: true, min: 0.01 },
    note: { type: String, default: '', maxlength: 500 },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    entryDate: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

module.exports = mongoose.models.TreasuryEntry || mongoose.model('TreasuryEntry', treasuryEntrySchema);
