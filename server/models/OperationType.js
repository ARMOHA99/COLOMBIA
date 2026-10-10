'use strict';

const mongoose = require('mongoose');

const operationTypeSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  label: { type: String, required: true },
  color: { type: String, default: '#9a978f' },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
});

module.exports = mongoose.models.OperationType || mongoose.model('OperationType', operationTypeSchema);
