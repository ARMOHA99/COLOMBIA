'use strict';

const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    category: { type: String, default: 'أخرى', trim: true, maxlength: 40 },
    price: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 }
  },
  { timestamps: true }
);

itemSchema.index({ category: 1, sortOrder: 1, name: 1 });

module.exports = mongoose.models.Item || mongoose.model('Item', itemSchema);
