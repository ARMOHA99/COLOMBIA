'use strict';

const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['leave', 'promotion', 'complaint'], required: true },
    message: { type: String, required: true, trim: true, maxlength: 2000 },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    resolution: { type: String, default: '', maxlength: 1000 },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    handledAt: { type: Date, default: null }
  },
  { timestamps: true }
);

ticketSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Ticket || mongoose.model('Ticket', ticketSchema);
