'use strict';

const mongoose = require('mongoose');

const farmPlotSchema = new mongoose.Schema(
  {
    plotNumber: { type: Number, required: true, unique: true },
    status: { type: String, enum: ['empty', 'planted', 'ready'], default: 'empty', index: true },
    crop: {
      key: String,
      label: String,
      targetProduct: String,
      growMs: Number,
      minQty: Number,
      maxQty: Number
    },
    plantedAt: { type: Date, default: null },
    readyAt: { type: Date, default: null },
    plantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    harvestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    lastYield: { type: Number, default: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.models.FarmPlot || mongoose.model('FarmPlot', farmPlotSchema);
