'use strict';

const mongoose = require('mongoose');

const harvestLogSchema = new mongoose.Schema({
  plotNumber: { type: Number, required: true },
  cropLabel: { type: String, default: '' },
  productName: { type: String, default: '' },
  qty: { type: Number, required: true, min: 1 },
  stockAfter: { type: Number, default: 0 },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  at: { type: Date, default: Date.now, index: true }
});

module.exports = mongoose.models.HarvestLog || mongoose.model('HarvestLog', harvestLogSchema);
