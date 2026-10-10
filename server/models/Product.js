'use strict';

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    category: { type: String, default: 'أخرى' },
    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    imageUrl: { type: String, default: '' },
    active: { type: Boolean, default: true },
    soldCount: { type: Number, default: 0 },
    sortOrder: { type: Number, default: 0 },
    farmProduced: { type: Boolean, default: false }
  },
  { timestamps: true }
);

productSchema.index({ name: 'text', category: 'text' });

module.exports = mongoose.models.Product || mongoose.model('Product', productSchema);
